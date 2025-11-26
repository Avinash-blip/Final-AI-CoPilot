import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { QuickSuggestions } from './QuickSuggestions';

interface Message {
    role: 'user' | 'assistant';
    content: string | any; // content can be string or JSON object
}

export const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMessage: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await axios.post('/api/chat', { message: text });
            const aiMessage: Message = { role: 'assistant', content: response.data };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request."
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const renderContent = (content: any) => {
        if (typeof content === 'string') {
            return <p className="whitespace-pre-wrap">{content}</p>;
        }

        // If it's our structured JSON response
        if (content.summary) {
            return (
                <div className="space-y-4">
                    <p className="font-medium text-lg">{content.summary}</p>

                    {content.metrics && content.metrics.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                            {content.metrics.map((metric: any, idx: number) => (
                                <div key={idx} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <div className="text-gray-400 text-sm">{metric.entity}</div>
                                    <div className="text-2xl font-bold mt-1">{metric.total} <span className="text-sm font-normal text-gray-500">total</span></div>
                                    {metric.delayed > 0 && (
                                        <div className="text-red-400 text-sm mt-2">
                                            {metric.delayed} delayed ({metric.delay_pct}%)
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {content.raw_answer && (
                        <div className="mt-4 text-gray-300 text-sm border-t border-gray-700 pt-4">
                            {content.raw_answer}
                        </div>
                    )}
                </div>
            );
        }

        return <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-xs">{JSON.stringify(content, null, 2)}</pre>;
    };

    return (
        <div className="flex flex-col h-screen bg-[#212121] text-gray-100 max-w-5xl mx-auto shadow-2xl">
            {/* Header */}
            <header className="p-4 border-b border-gray-700 flex items-center justify-between bg-[#212121]">
                <div className="flex items-center gap-2">
                    <Bot className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-semibold">AI Ops Copilot</h1>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-8">
                        <Bot className="w-16 h-16 opacity-20" />
                        <p className="text-xl font-medium">How can I help you with your logistics data today?</p>
                        <QuickSuggestions onSelect={sendMessage} />
                    </div>
                )}

                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                        )}

                        <div
                            className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-[#2f2f2f] text-gray-100 rounded-tl-none border border-gray-700'
                                }`}
                        >
                            {renderContent(msg.content)}
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-white" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-[#2f2f2f] p-4 rounded-2xl rounded-tl-none border border-gray-700 flex items-center">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#212121] border-t border-gray-700">
                <div className="relative max-w-4xl mx-auto">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about trips, delays, or transporters..."
                        className="w-full bg-[#2f2f2f] text-white rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none border border-gray-600"
                        rows={1}
                        style={{ minHeight: '50px', maxHeight: '200px' }}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2.5 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                    AI Ops Copilot can make mistakes. Consider checking important information.
                </div>
            </div>
        </div>
    );
};
