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
import passport from 'passport';
import cookieParser from 'cookie-parser';
import process from 'process';
import * as db from './db';
import * as auth from './auth/auth';
import { User, Organization } from '../../types';

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
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// --- WebSocket Setup ---
server.on('upgrade', async (request, socket, head) => {
  try {
    const { pathname, query } = url.parse(request.url!, true);

    if (pathname === '/ws') {
      const token = query.token as string;
      if (!token) {
        socket.destroy();
        return;
      }
      const payload = auth.verifyToken(token);
      const user = await db.findUserById(payload.userId);
      if (!user) {
        socket.destroy();
        return;
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

wss.on('connection', (ws, request, userId) => {
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
    const user = await db.switchUserOrganization(req.user!.id, organizationId);
    // Re-issue a token with the new context
    const token = auth.generateToken(user.id, user.currentOrganization.id);
    res.json({ user, token });
});

// Patient Routes
app.get('/api/patient/dashboard', authenticate, async (req, res) => res.json(await db.getPatientDashboardData(req.user!.id)));
app.post('/api/patient/appointments', authenticate, async (req, res) => {
    await db.createAppointment(req.user!.id, req.body);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});
app.post('/api/patient/simulate-wearable', authenticate, async (req, res) => {
    await db.addSimulatedWearableData(req.user!.id);
    notifyUser(req.user!.id, 'refetch');
    res.status(200).send();
})

// HCW Routes
app.get('/api/hcw/dashboard', authenticate, async (req, res) => res.json(await db.getHcwDashboardData(req.user!.id, req.organizationContext!.id)));
app.post('/api/hcw/notes', authenticate, async (req, res) => {
    await db.createClinicalNote(req.user!.id, req.body);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});
app.post('/api/hcw/lab-tests', authenticate, async (req, res) => {
    await db.createLabTest(req.user!.id, req.body);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});
app.post('/api/hcw/prescriptions', authenticate, async (req, res) => {
    await db.createPrescription(req.user!.id, req.body);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});
app.post('/api/hcw/referrals', authenticate, async (req, res) => {
    await db.createReferral(req.user!.id, req.body);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});

// Admin Routes
app.get('/api/admin/dashboard', authenticate, async (req, res) => res.json(await db.getAdminDashboardData(req.organizationContext!.id)));
app.put('/api/users/:id', authenticate, async (req, res) => {
    await db.updateUser(req.params.id, req.body);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.post('/api/admin/organizations/link', authenticate, async (req, res) => {
    await db.linkOrganizations(req.body.childId, req.body.parentId);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.post('/api/admin/organizations/unlink', authenticate, async (req, res) => {
    await db.unlinkOrganization(req.body.childId);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.post('/api/admin/departments', authenticate, async (req, res) => {
    await db.createDepartment(req.body.name, req.organizationContext!.id);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});
app.post('/api/admin/rooms', authenticate, async (req, res) => {
    await db.createRoom(req.body.name, req.body.type, req.organizationContext!.id);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});
app.post('/api/admin/beds', authenticate, async (req, res) => {
    await db.createBed(req.body.name, req.body.roomId);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
});


// Command Center Routes
app.get('/api/command-center/dashboard', authenticate, async (req, res) => res.json(await db.getCommandCenterDashboardData(req.organizationContext!.id)));
app.post('/api/command-center/admit', authenticate, async (req, res) => {
    await db.admitPatient(req.body.patientId, req.body.bedId, req.body.reason);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.post('/api/command-center/discharge', authenticate, async (req, res) => {
    await db.dischargePatient(req.body.patientId);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});


// Other Role Dashboards
app.get('/api/pharmacist/dashboard', authenticate, async (req, res) => res.json(await db.getPharmacistDashboardData(req.organizationContext!.id)));
app.get('/api/nurse/dashboard', authenticate, async (req, res) => res.json(await db.getNurseDashboardData(req.organizationContext!.id)));
app.get('/api/lab/dashboard', authenticate, async (req, res) => res.json(await db.getLabDashboardData(req.organizationContext!.id)));
app.get('/api/receptionist/dashboard', authenticate, async (req, res) => res.json(await db.getReceptionistDashboardData(req.organizationContext!.id)));
app.get('/api/logistics/dashboard', authenticate, async (req, res) => res.json(await db.getLogisticsDashboardData(req.organizationContext!.id)));


// Generic Update Routes
app.put('/api/prescriptions/:id/status', authenticate, async (req, res) => {
    await db.updatePrescription(req.params.id, req.body.status);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.put('/api/lab-tests/:id', authenticate, async (req, res) => {
    await db.updateLabTest(req.params.id, req.body.status, req.body.result);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.post('/api/appointments/:id/check-in', authenticate, async(req, res) => {
    await db.checkInPatient(req.params.id);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.post('/api/triage/:patientId/vitals', authenticate, async (req, res) => {
    await db.recordVitals(req.params.patientId, req.body);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.put('/api/transport/:id/status', authenticate, async (req, res) => {
    await db.updateTransportRequest(req.params.id, req.body.status);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.put('/api/lab-samples/:id/status', authenticate, async (req, res) => {
    await db.updateLabTest(req.params.id, req.body.status);
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(200).send();
});
app.post('/api/messages', authenticate, async (req, res) => {
    await db.createMessage(req.user!.id, req.body);
    // In a real app, you would notify specific recipients
    notifyAllOrgUsers(req.organizationContext!.id, 'refetch');
    res.status(201).send();
})

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