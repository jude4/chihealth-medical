import React, { useState } from 'react';
import { ChatMessage, MessageRole, TriageSuggestion } from '../../types.ts';
import { runChat, getTriageSuggestion } from '../../services/geminiService.ts';
import { AISuggestionCard } from '../../components/patient/AISuggestionCard.tsx';
// Fix: Import the Button component.
import { Button } from '../../components/common/Button.tsx';

interface SymptomCheckerProps {
    onBookAppointmentWithSuggestion: (specialty: string) => void;
}

const UserIcon: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white flex-shrink-0">U</div>
);
const ModelIcon: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-background-tertiary flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
    </div>
);

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isModel = message.role === MessageRole.MODEL;
  const bubbleClasses = `max-w-2xl px-5 py-3 rounded-2xl ${isModel ? 'bg-background-tertiary rounded-bl-none' : 'bg-primary text-white rounded-br-none'}`;
  return (
    <div className={`flex items-start gap-3 ${!isModel && 'justify-end'}`}>
      {isModel && <ModelIcon />}
      <div className={bubbleClasses}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      </div>
       {!isModel && <UserIcon />}
    </div>
  );
};

const SendIcon: React.FC<{ isLoading: boolean }> = ({ isLoading }) => (
  isLoading ? (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
  )
);

export const SymptomChecker: React.FC<SymptomCheckerProps> = ({ onBookAppointmentWithSuggestion }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: MessageRole.MODEL, content: "Hello! I'm your AI Health Assistant. Please describe your symptoms, and I'll provide you with some information. \n\n**Remember, this is not a medical diagnosis. Please consult a qualified healthcare professional for any health concerns.**" },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<TriageSuggestion | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiSuggestion]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: MessageRole.USER, content: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setError(null);
    setAiSuggestion(null);

    try {
      // Get conversational response
      const response = await runChat(currentInput);
      const modelMessage: ChatMessage = { role: MessageRole.MODEL, content: response };
      setMessages((prev) => [...prev, modelMessage]);

      // Get structured triage suggestion in the background
      const suggestion = await getTriageSuggestion(currentInput);
      if (suggestion && suggestion.recommendation === 'appointment') {
        setAiSuggestion(suggestion);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = 'Sorry, I encountered an error while processing your request. Please try again.';
      setError(errorMessage);
      setMessages((prev) => [...prev, { role: MessageRole.MODEL, content: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full content-card overflow-hidden">
      <div className="p-6 border-b border-border-primary">
          <h2 className="text-2xl font-bold text-text-primary">AI Health Assistant</h2>
          <p className="text-text-secondary text-sm">Get information and guidance on your symptoms.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => <MessageBubble key={index} message={msg} />)}
        {aiSuggestion && (
            <AISuggestionCard suggestion={aiSuggestion} onBookAppointment={onBookAppointmentWithSuggestion} />
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-border-primary">
        {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your symptoms..."
                className="flex-1 form-input"
                disabled={isLoading}
            />
            <Button type="submit" isLoading={isLoading} disabled={!input.trim()}>
                <SendIcon isLoading={isLoading} />
            </Button>
        </form>
      </div>
    </div>
  );
};