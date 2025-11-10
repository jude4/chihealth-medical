// Load environment variables from .env file
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { fileURLToPath } from 'url';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
// Multer is optional in development; if it's not installed, we'll disable avatar uploads
let multer: any = null;
try {
  // dynamic import so a missing package doesn't crash the server at startup
  // (useful when running without installing optional dev deps)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  multer = (await import('multer')).default;
} catch (err) {
  console.warn('Optional dependency "multer" is not installed - avatar upload endpoints will be disabled.');
}
import passport from 'passport';
import cookieParser from 'cookie-parser';
import process from 'process';
import * as db from './db.js';
import * as auth from './auth/auth.js';
import { User, Organization } from '../../types.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User | (User & { isNew?: boolean, tempToken?: string });
      organizationContext?: Organization;
    }
  }
}

// Fix: __dirname is not available in ES modules, so we define it manually.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const avatarDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);

// Multer setup for avatar uploads (only if multer is available)
let upload: any = null;
if (multer) {
  const storage = multer.diskStorage({
    // use typed params for the multer callbacks
    destination: function (req: Request, file: any, cb: (err: any, dest?: string) => void) {
      cb(null, avatarDir);
    },
    filename: function (req: Request, file: any, cb: (err: any, filename?: string) => void) {
      const ext = path.extname((file && file.originalname) || '') || '.png';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
    }
  });
  upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });
}


// WebSocket connections map
const clients = new Map<string, WebSocket>();

// Auth Middleware
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const payload = auth.verifyToken(token);
    const user = await db.findUserById(payload.userId);
    if (!user) return res.status(401).json({ message: 'Invalid user' });

  req.user = user;
  req.organizationContext = user.currentOrganization;
  return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// --- WebSocket Setup ---
server.on('upgrade', async (request, socket, head) => {
  try {
    const { pathname, query } = url.parse(request.url!, true);

    if (pathname === '/ws') {
      const token = query.token as string | undefined;
      let user: any = undefined;

      if (!token) {
        // In development, allow an unauthenticated websocket so the UI can function
        // without a valid token; in production we refuse the connection.
        if (process.env.NODE_ENV === 'production') {
          console.warn('WebSocket upgrade refused: missing token');
          socket.destroy();
          return;
        }
        console.info('WebSocket upgrade: no token provided, attaching dev user');
        user = { id: 'dev-user', currentOrganization: { id: 'dev-org' } } as any;
      } else {
        try {
          const payload = auth.verifyToken(token);
          user = await db.findUserById(payload.userId);
          if (!user) {
            console.warn('WebSocket upgrade refused: user not found for token');
            socket.destroy();
            return;
          }
        } catch (err) {
          console.warn('WebSocket upgrade refused: token verification failed', err);
          socket.destroy();
          return;
        }
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, user.id);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket, request: http.IncomingMessage, userId: string) => {
  clients.set(userId, ws);
  console.log(`WebSocket client connected: ${userId}`);

  ws.on('close', () => {
    clients.delete(userId);
    console.log(`WebSocket client disconnected: ${userId}`);
  });
});

const notifyUser = (userId: string, type: string) => {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type }));
  }
};

const notifyAllOrgUsers = async (orgId: string, type: string) => {
    // This is a simplified version. A real app would query users by org.
    console.log(`Notifying all users in org ${orgId} to ${type}`);
    // For this mock, we'll just iterate all connected clients.
    wss.clients.forEach(client => {
         if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type }));
        }
    });
}

// --- API Routes ---

// Auth Routes
app.use('/api/auth', auth.authRouter);

// User Routes
app.get('/api/users/me', authenticate, (req: Request, res: Response) => {
  res.json(req.user);
});

app.post('/api/users/switch-organization', authenticate, async (req: Request, res: Response) => {
  const { organizationId } = req.body;
  const user = await db.switchUserOrganization((req.user as User).id, organizationId);
    // Re-issue a token with the new context
    const token = auth.generateToken(user.id, user.currentOrganization.id);
    res.json({ user, token });
});

// Patient Routes
app.get('/api/patient/dashboard', authenticate, async (req, res) => res.json(await db.getPatientDashboardData((req.user as User).id)));
app.post('/api/patient/appointments', authenticate, async (req, res) => {
  await db.createAppointment((req.user as User).id, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});
// Delete appointment (patient or HCW can call with auth)
app.delete('/api/patient/appointments/:id', authenticate, async (req, res) => {
  try {
  const ok = await db.deleteAppointment(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Appointment not found' });
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    return res.status(200).send();
  } catch (err: any) {
    console.error('Failed to delete appointment', err);
    return res.status(500).json({ message: err.message || 'Failed to delete appointment' });
  }
});

// Update (reschedule) appointment
app.put('/api/patient/appointments/:id', authenticate, async (req, res) => {
  try {
  const appt = await db.updateAppointment(req.params.id, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    return res.status(200).json(appt);
  } catch (err: any) {
    console.error('Failed to update appointment', err);
    return res.status(400).json({ message: err.message || 'Failed to update appointment' });
  }
});
app.post('/api/patient/simulate-wearable', authenticate, async (req, res) => {
  await db.addSimulatedWearableData((req.user as User).id);
  notifyUser((req.user as User).id, 'refetch');
    res.status(200).send();
})

app.post('/api/patient/devices', authenticate, async (req, res) => {
  try {
    const device = await db.addWearableDevice((req.user as User).id, req.body);
    notifyUser((req.user as User).id, 'refetch');
    return res.status(201).json(device);
  } catch (err: any) {
    console.error('Failed to add wearable device', err);
    return res.status(400).json({ message: err.message || 'Failed to add device' });
  }
});

app.delete('/api/patient/devices/:id', authenticate, async (req, res) => {
  try {
    const ok = await db.removeWearableDevice((req.user as User).id, req.params.id);
    if (!ok) return res.status(404).json({ message: 'Device not found' });
    notifyUser((req.user as User).id, 'refetch');
    return res.status(200).send();
  } catch (err: any) {
    console.error('Failed to remove wearable device', err);
    return res.status(400).json({ message: err.message || 'Failed to remove device' });
  }
});

// HCW Routes
app.get('/api/hcw/dashboard', authenticate, async (req, res) => res.json(await db.getHcwDashboardData((req.user as User).id, (req.organizationContext as Organization).id)));
app.post('/api/hcw/notes', authenticate, async (req, res) => {
  await db.createClinicalNote((req.user as User).id, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});
app.post('/api/hcw/lab-tests', authenticate, async (req, res) => {
  await db.createLabTest((req.user as User).id, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});
app.post('/api/hcw/prescriptions', authenticate, async (req, res) => {
  await db.createPrescription((req.user as User).id, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});
app.post('/api/hcw/referrals', authenticate, async (req, res) => {
  await db.createReferral((req.user as User).id, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});

// Admin Routes
app.get('/api/admin/dashboard', authenticate, async (req, res) => res.json(await db.getAdminDashboardData((req.organizationContext as Organization).id)));
app.put('/api/users/:id', authenticate, async (req, res) => {
  await db.updateUser(req.params.id, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.post('/api/admin/organizations/link', authenticate, async (req, res) => {
  await db.linkOrganizations(req.body.childId, req.body.parentId);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.post('/api/admin/organizations/unlink', authenticate, async (req, res) => {
  await db.unlinkOrganization(req.body.childId);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.post('/api/admin/departments', authenticate, async (req, res) => {
  await db.createDepartment(req.body.name, (req.organizationContext as Organization).id);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});
app.post('/api/admin/rooms', authenticate, async (req, res) => {
  await db.createRoom(req.body.name, req.body.type, (req.organizationContext as Organization).id);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});
app.post('/api/admin/beds', authenticate, async (req, res) => {
  await db.createBed(req.body.name, req.body.roomId);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
});


// Command Center Routes
app.get('/api/command-center/dashboard', authenticate, async (req, res) => res.json(await db.getCommandCenterDashboardData((req.organizationContext as Organization).id)));
app.post('/api/command-center/admit', authenticate, async (req, res) => {
  await db.admitPatient(req.body.patientId, req.body.bedId, req.body.reason);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.post('/api/command-center/discharge', authenticate, async (req, res) => {
  await db.dischargePatient(req.body.patientId);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});


// Other Role Dashboards
app.get('/api/pharmacist/dashboard', authenticate, async (req, res) => res.json(await db.getPharmacistDashboardData((req.organizationContext as Organization).id)));
app.get('/api/nurse/dashboard', authenticate, async (req, res) => res.json(await db.getNurseDashboardData((req.organizationContext as Organization).id)));
app.get('/api/lab/dashboard', authenticate, async (req, res) => res.json(await db.getLabDashboardData((req.organizationContext as Organization).id)));
app.get('/api/receptionist/dashboard', authenticate, async (req, res) => res.json(await db.getReceptionistDashboardData((req.organizationContext as Organization).id)));
app.get('/api/logistics/dashboard', authenticate, async (req, res) => res.json(await db.getLogisticsDashboardData((req.organizationContext as Organization).id)));


// Generic Update Routes
app.put('/api/prescriptions/:id/status', authenticate, async (req, res) => {
  await db.updatePrescription(req.params.id, req.body.status);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.put('/api/lab-tests/:id', authenticate, async (req, res) => {
  await db.updateLabTest(req.params.id, req.body.status, req.body.result);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.post('/api/appointments/:id/check-in', authenticate, async(req, res) => {
  await db.checkInPatient(req.params.id);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.post('/api/triage/:patientId/vitals', authenticate, async (req, res) => {
  await db.recordVitals(req.params.patientId, req.body);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.put('/api/transport/:id/status', authenticate, async (req, res) => {
  await db.updateTransportRequest(req.params.id, req.body.status);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.put('/api/lab-samples/:id/status', authenticate, async (req, res) => {
  await db.updateLabTest(req.params.id, req.body.status);
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(200).send();
});
app.post('/api/messages', authenticate, async (req, res) => {
  await db.createMessage((req.user as User).id, req.body);
  // In a real app, you would notify specific recipients
  notifyAllOrgUsers((req.organizationContext as Organization).id, 'refetch');
    res.status(201).send();
})

// AI Proxy Route - client calls this endpoint. In development this returns a
// harmless stub. In production you should forward to a real server-side AI SDK.
app.post('/api/ai/generate', async (req: Request, res: Response) => {
  try {
    // In production, require authentication. In development allow unauthenticated calls
    if (process.env.NODE_ENV === 'production') {
      const authHeader = (req.headers.authorization || '').toString();
      const token = authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Authentication required' });
      try {
        const payload = auth.verifyToken(token);
        const user = await db.findUserById(payload.userId);
        if (!user) return res.status(401).json({ message: 'Invalid user' });
        // attach user for potential server-side AI use
        (req as any).user = user;
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    const { model, contents } = req.body || {};
    if (!contents) return res.status(400).json({ error: 'Missing contents' });

    // Development stub: if the prompt asks for an EHR summary, synthesize a small,
    // readable summary from the embedded JSON to make the UI useful during dev.
    if (process.env.NODE_ENV !== 'production' && typeof contents === 'string' && /EHR summary|EHR Summary|write a concise EHR summary/i.test(contents)) {
      try {
        const extractJson = (label: string) => {
          const re = new RegExp(label + "\\n([\\s\\S]*?)(\\n\\n|$)", 'i');
          const m = contents.match(re);
          if (!m) return null;
          try { return JSON.parse(m[1]); } catch { return null; }
        };

        const patient = extractJson('Patient:') || {};
        const clinicalNotes = extractJson('Clinical Notes:') || [];
        const labTests = extractJson('Lab Tests:') || [];

        const name = patient.name || patient.fullName || 'Unknown patient';
        const dob = patient.dateOfBirth || patient.dob || '';
        const recentNote = Array.isArray(clinicalNotes) && clinicalNotes.length ? clinicalNotes[0].content || clinicalNotes[0] : 'No recent notes';
        const latestLab = Array.isArray(labTests) && labTests.length ? `${labTests[0].testName || 'Lab'}: ${labTests[0].result || 'Pending'}` : 'No recent labs';

        const summaryLines = [
          `Patient: ${name}` + (dob ? ` (DOB: ${dob})` : ''),
          `Key findings: ${recentNote}`,
          `Recent labs: ${latestLab}`,
          'Recommendation: Review recent notes and labs; consider follow-up as clinically indicated.'
        ];

        return res.json({ text: summaryLines.join('\n\n') });
      } catch (err) {
        // fall through to the generic preview below
        console.warn('Dev AI summary generation failed, falling back to preview', err);
      }
    }

    // Generic development stub response — keep it short and deterministic.
    const preview = typeof contents === 'string' ? contents.slice(0, 300) : JSON.stringify(contents);
    const text = `(dev AI) Response for model=${model || 'unknown'}\n\n${preview}${preview.length >= 300 ? '...' : ''}`;
    return res.json({ text });
  } catch (err) {
    console.error('AI proxy error', err);
    return res.status(500).json({ error: 'AI proxy failed' });
  }
});

// --- Static File Serving ---
// Only serve static files in production (when dist folder exists)
// In development, the frontend runs separately on port 5173
const distPath = path.join(__dirname, '..', '..', 'dist');
const distExists = fs.existsSync(distPath);

if (distExists) {
  app.use(express.static(distPath));
  
  // The "catchall" handler: for any request that doesn't
  // match one above, send back React's index.html file from the build directory.
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // In development mode, return a helpful message for non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.status(404).json({ 
        message: 'Frontend not built. In development, access the frontend at http://localhost:5173',
        hint: 'Run "npm run dev:all" to start both frontend and backend servers'
      });
    } else {
      res.status(404).json({ message: 'Not found' });
    }
  });
}

// Serve uploaded files in development
app.use('/uploads', express.static(uploadsDir));


const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    console.error(`   Please stop the process using port ${PORT} or use a different port.`);
    console.error(`   To find and kill the process: netstat -ano | findstr :${PORT}\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Avatar upload route: if multer is installed, enable actual uploads; otherwise return 501
if (upload) {
  app.post('/api/users/avatar', authenticate, upload.single('avatar'), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      // Build a URL for the uploaded file. In development we can serve from /uploads
      const fileUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
  // Update user record
  const updated = await db.updateUser((req.user as User).id, { avatarUrl: fileUrl } as any);
  return res.json({ avatarUrl: fileUrl, user: updated });
    } catch (err: any) {
      console.error('Failed to upload avatar', err);
      return res.status(500).json({ message: err.message || 'Failed to upload avatar' });
    }
  });
} else {
  app.post('/api/users/avatar', authenticate, async (req: Request, res: Response) => {
    return res.status(501).json({ message: 'Avatar upload disabled: optional dependency "multer" is not installed.' });
  });
}

// Lightweight health endpoint for dev/probing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});