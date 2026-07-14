import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import {
    MessageSquare, Send, ArrowLeft, Clock,
    Loader2, Search, X, Plus, Shield, Users
} from 'lucide-react';

const API = 'http://localhost:5000/api/messages';
const getHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

const fmtTime = (date) => {
    if (!date) return '';
    const d = new Date(date), now = new Date(), diff = (now - d) / 1000;
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const roleColor = (role) => role === 'admin' ? '#1E6BB5' : role === 'driver' ? '#059669' : '#7C3AED';

// ── Standalone avatar (OUTSIDE parent so it never remounts) ──────────────────
const MsgAvatar = ({ user, size = 36 }) => {
    const [err, setErr] = useState(false);
    const letter = (user?.fullName || '?').charAt(0).toUpperCase();
    return (
        <div
            className="rounded-full flex items-center justify-center text-white font-black shrink-0 overflow-hidden"
            style={{ width: size, height: size, minWidth: size, background: roleColor(user?.role), fontSize: size * 0.38 }}
        >
            {user?.profileImage && !err
                ? <img src={user.profileImage} alt="" className="w-full h-full object-cover rounded-full" onError={() => setErr(true)} />
                : letter}
        </div>
    );
};

// ── Single message bubble (OUTSIDE parent) ────────────────────────────────────
const Bubble = ({ msg, myId }) => {
    const senderId = String(msg.sender?._id || msg.sender);
    const isMe = senderId === String(myId);
    return (
        <div className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            {!isMe && <MsgAvatar user={msg.sender} size={30} />}
            <div className={`flex flex-col gap-1 max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                {msg.subject && (
                    <p className={`text-[10px] font-black uppercase tracking-wider px-1 ${isMe ? 'text-rra-blue' : 'text-gray-400'}`}>
                        {msg.subject}
                    </p>
                )}
                <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                        isMe ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm shadow-sm'
                    }`}
                    style={isMe ? { background: 'var(--rra-blue)' } : {}}
                >
                    {msg.body}
                </div>
                <span className={`flex items-center gap-1 text-[10px] text-gray-400 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <Clock size={9} />{fmtTime(msg.createdAt)}
                </span>
            </div>
            {isMe && <MsgAvatar user={msg.sender} size={30} />}
        </div>
    );
};

// ── Thread row in inbox list (OUTSIDE parent) ─────────────────────────────────
const ThreadRow = ({ thread, selected, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
            selected ? 'bg-rra-blue/5 dark:bg-rra-blue/10 border-l-[3px] border-l-rra-blue pl-[13px]' : ''
        }`}
    >
        <div className="relative shrink-0">
            <MsgAvatar user={thread.user} size={42} />
            {thread.user?.role === 'admin' && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--rra-gold)' }}>
                    <Shield size={9} className="text-white" />
                </div>
            )}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
                <p className={`text-sm truncate ${thread.unreadCount > 0 ? 'font-black text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>
                    {thread.user.fullName}
                </p>
                <span className="text-[10px] text-gray-400 shrink-0 ml-2">{fmtTime(thread.lastMessage?.createdAt)}</span>
            </div>
            <p className="text-xs text-gray-400 truncate">{thread.lastMessage?.subject || 'No messages yet'}</p>
            <span className="text-[9px] font-bold text-gray-400 capitalize">{thread.user.role}</span>
        </div>
        {thread.unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-black flex items-center justify-center px-1 shrink-0"
                style={{ background: 'var(--rra-blue)' }}>
                {thread.unreadCount}
            </span>
        )}
    </button>
);

// ── User search row (OUTSIDE parent) ─────────────────────────────────────────
const UserRow = ({ user, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0 text-left"
    >
        <MsgAvatar user={user} size={36} />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user.email} · <span className="capitalize">{user.role}</span></p>
        </div>
    </button>
);

// ── Main component ────────────────────────────────────────────────────────────
const Messages = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const { showToast } = useDialog();

    const [inbox, setInbox] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingInbox, setLoadingInbox] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [sending, setSending] = useState(false);

    // compose state
    const [showCompose, setShowCompose] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [userResults, setUserResults] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [composeRecipient, setComposeRecipient] = useState(null);
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');

    // reply state
    const [replySubject, setReplySubject] = useState('');
    const [replyBody, setReplyBody] = useState('');

    // mobile: 'inbox' | 'compose' | 'chat'
    const [mobilePanel, setMobilePanel] = useState('inbox');

    const bottomRef = useRef(null);
    const userSearchTimer = useRef(null);

    // ── data fetching ─────────────────────────────────────────────────────────
    const loadInbox = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API}/inbox`, { headers: getHeaders() });
            setInbox(data);
        } catch (e) { console.error(e); }
        finally { setLoadingInbox(false); }
    }, []);

    useEffect(() => { loadInbox(); }, [loadInbox]);

    const openThread = useCallback(async (thread) => {
        setSelectedThread(thread);
        setShowCompose(false);
        setMobilePanel('chat');
        setLoadingMsgs(true);
        setMessages([]);
        try {
            const { data } = await axios.get(`${API}/conversation/${thread.userId}`, { headers: getHeaders() });
            setMessages(data);
            loadInbox();
        } catch (e) { console.error(e); }
        finally { setLoadingMsgs(false); }
    }, [loadInbox]);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // real-time incoming
    useEffect(() => {
        if (!socket) return;
        const handle = (msg) => {
            const sid = String(msg.sender?._id || msg.sender);
            if (selectedThread && sid === String(selectedThread.userId)) {
                setMessages(prev => [...prev, msg]);
            }
            loadInbox();
        };
        socket.on('newMessage', handle);
        return () => socket.off('newMessage', handle);
    }, [socket, selectedThread, loadInbox]);

    // ── user search (debounced) ───────────────────────────────────────────────
    const searchUsers = useCallback((q) => {
        setUserSearch(q);
        clearTimeout(userSearchTimer.current);
        if (!q.trim()) { setUserResults([]); return; }
        setSearchingUsers(true);
        userSearchTimer.current = setTimeout(async () => {
            try {
                const { data } = await axios.get(`${API}/users`, { params: { search: q }, headers: getHeaders() });
                setUserResults(data);
            } catch (e) { setUserResults([]); }
            finally { setSearchingUsers(false); }
        }, 280);
    }, []);

    // Preload all users when compose opens
    useEffect(() => {
        if (!showCompose) { setUserSearch(''); setUserResults([]); setComposeRecipient(null); return; }
        (async () => {
            setSearchingUsers(true);
            try {
                const { data } = await axios.get(`${API}/users`, { headers: getHeaders() });
                setUserResults(data);
            } catch (e) {}
            finally { setSearchingUsers(false); }
        })();
    }, [showCompose]);

    // ── send reply ────────────────────────────────────────────────────────────
    const sendReply = async (e) => {
        e.preventDefault();
        if (!selectedThread || !replyBody.trim()) return;
        setSending(true);
        try {
            const { data } = await axios.post(API, {
                recipientId: selectedThread.userId,
                subject: replySubject.trim() || `Re: ${messages[0]?.subject || 'Message'}`,
                body: replyBody.trim()
            }, { headers: getHeaders() });
            setMessages(prev => [...prev, data]);
            setReplyBody('');
            setReplySubject('');
            loadInbox();
        } catch (e) { showToast(e.response?.data?.message || 'Failed to send', 'error'); }
        finally { setSending(false); }
    };

    // ── send compose (new message) ─────────────────────────────────────────────
    const sendCompose = async (e) => {
        e.preventDefault();
        if (!composeRecipient || !composeSubject.trim() || !composeBody.trim()) return;
        setSending(true);
        try {
            await axios.post(API, {
                recipientId: composeRecipient._id,
                subject: composeSubject.trim(),
                body: composeBody.trim()
            }, { headers: getHeaders() });
            // open that conversation
            await openThread({ userId: composeRecipient._id, user: composeRecipient });
            setComposeSubject('');
            setComposeBody('');
            setShowCompose(false);
        } catch (e) { showToast(e.response?.data?.message || 'Failed to send', 'error'); }
        finally { setSending(false); }
    };

    const totalUnread = inbox.reduce((s, t) => s + (t.unreadCount || 0), 0);

    // ─────────────────────────────────────────────────────────────────────────
    // JSX panels — inlined, NOT separate component functions inside this render
    // ─────────────────────────────────────────────────────────────────────────

    const inboxPanel = (
        <div className={`${mobilePanel !== 'inbox' ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[280px] xl:w-[300px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-full`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <MessageSquare size={15} className="text-rra-blue" />
                        <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Messages</span>
                        {totalUnread > 0 && (
                            <span className="min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-black flex items-center justify-center px-1"
                                style={{ background: 'var(--rra-blue)' }}>{totalUnread}</span>
                        )}
                    </div>
                    <button
                        onClick={() => { setShowCompose(true); setSelectedThread(null); setMobilePanel('compose'); }}
                        className="p-1.5 rounded-xl text-white hover:opacity-90 active:scale-95 transition-all"
                        style={{ background: 'var(--rra-blue)' }}
                        title="New conversation"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Scrollable thread list */}
            <div className="flex-1 overflow-y-auto">
                {loadingInbox ? (
                    <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-rra-blue" /></div>
                ) : inbox.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <Users size={30} className="mx-auto text-gray-200 dark:text-gray-600 mb-2" />
                        <p className="text-xs font-bold text-gray-400">No conversations yet</p>
                        <button onClick={() => { setShowCompose(true); setMobilePanel('compose'); }}
                            className="mt-2 text-xs font-bold text-rra-blue hover:underline">Start chatting</button>
                    </div>
                ) : (
                    inbox.map(t => (
                        <ThreadRow
                            key={t.userId}
                            thread={t}
                            selected={selectedThread?.userId === t.userId}
                            onClick={() => openThread(t)}
                        />
                    ))
                )}
            </div>
        </div>
    );

    const composePanel = (
        <div className={`${(!showCompose || mobilePanel !== 'compose') ? 'hidden' : 'flex'} lg:flex flex-1 flex-col min-w-0 bg-white dark:bg-gray-900 ${!showCompose ? 'lg:hidden' : ''}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center gap-3">
                <button onClick={() => { setShowCompose(false); setMobilePanel('inbox'); }}
                    className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 lg:hidden">
                    <ArrowLeft size={16} />
                </button>
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">New Message</h3>
                <button onClick={() => { setShowCompose(false); if (selectedThread) setMobilePanel('chat'); }}
                    className="ml-auto p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hidden lg:flex">
                    <X size={15} />
                </button>
            </div>

            <form onSubmit={sendCompose} className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
                {/* Recipient */}
                <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">To</label>
                    {composeRecipient ? (
                        <div className="flex items-center gap-3 p-3 bg-rra-blue/5 dark:bg-rra-blue/10 border border-rra-blue/20 rounded-xl">
                            <MsgAvatar user={composeRecipient} size={32} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{composeRecipient.fullName}</p>
                                <p className="text-xs text-gray-400 capitalize">{composeRecipient.role}</p>
                            </div>
                            <button type="button" onClick={() => setComposeRecipient(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>
                    ) : (
                        <div>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={userSearch}
                                    onChange={e => searchUsers(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20"
                                />
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl max-h-48 overflow-y-auto">
                                {searchingUsers
                                    ? <div className="flex items-center justify-center py-4"><Loader2 size={16} className="animate-spin text-rra-blue" /></div>
                                    : userResults.length === 0
                                        ? <p className="text-center text-xs text-gray-400 py-4">{userSearch ? 'No users found' : 'Start typing to search'}</p>
                                        : userResults.map(u => <UserRow key={u._id} user={u} onClick={() => setComposeRecipient(u)} />)
                                }
                            </div>
                        </div>
                    )}
                </div>

                {/* Subject */}
                <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Subject</label>
                    <input
                        type="text"
                        placeholder="Message subject..."
                        value={composeSubject}
                        onChange={e => setComposeSubject(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20"
                    />
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col">
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Message</label>
                    <textarea
                        placeholder="Write your message..."
                        value={composeBody}
                        onChange={e => setComposeBody(e.target.value)}
                        required
                        className="flex-1 min-h-[120px] px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20 resize-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={sending || !composeRecipient || !composeSubject.trim() || !composeBody.trim()}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-black uppercase tracking-wider active:scale-95 disabled:opacity-60 shadow-sm"
                    style={{ background: 'var(--rra-blue)' }}
                >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {sending ? 'Sending...' : 'Send Message'}
                </button>
            </form>
        </div>
    );

    const chatPanel = selectedThread ? (
        <div className={`${mobilePanel !== 'chat' ? 'hidden lg:flex' : 'flex'} flex-1 flex-col min-w-0 bg-white dark:bg-gray-900 h-full`}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
                <button onClick={() => setMobilePanel('inbox')} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 lg:hidden">
                    <ArrowLeft size={16} />
                </button>
                <div className="relative">
                    <MsgAvatar user={selectedThread.user} size={38} />
                    {selectedThread.user?.role === 'admin' && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--rra-gold)' }}>
                            <Shield size={9} className="text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">{selectedThread.user?.fullName}</p>
                    <p className="text-xs text-gray-400 capitalize">{selectedThread.user?.role}</p>
                </div>
            </div>

            {/* Scrollable messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
                {loadingMsgs ? (
                    <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-rra-blue" /></div>
                ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-8">No messages yet — say something!</p>
                ) : (
                    messages.map(msg => <Bubble key={msg._id} msg={msg} myId={user?._id} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Reply composer — plain JSX, NO inner component function */}
            <form
                onSubmit={sendReply}
                className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2 shrink-0"
            >
                <input
                    type="text"
                    placeholder="Subject (optional)..."
                    value={replySubject}
                    onChange={e => setReplySubject(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rra-blue focus:ring-1 focus:ring-rra-blue/30"
                />
                <div className="flex gap-2">
                    <textarea
                        placeholder="Write a reply... (Enter ↵ to send, Shift+Enter for new line)"
                        value={replyBody}
                        onChange={e => setReplyBody(e.target.value)}
                        rows={2}
                        required
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rra-blue focus:ring-1 focus:ring-rra-blue/30 resize-none"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                    />
                    <button
                        type="submit"
                        disabled={sending || !replyBody.trim()}
                        className="px-3 rounded-xl text-white font-black active:scale-95 disabled:opacity-60 flex items-center justify-center shrink-0 self-stretch"
                        style={{ background: 'var(--rra-blue)' }}
                    >
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </form>
        </div>
    ) : null;

    const emptyRight = !showCompose && !selectedThread ? (
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-950">
            <div className="w-16 h-16 rounded-full bg-rra-blue/10 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-rra-blue" />
            </div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1">Your Messages</h3>
            <p className="text-xs text-gray-400 max-w-xs mb-5">Select a conversation or start a new one.</p>
            <button
                onClick={() => { setShowCompose(true); setMobilePanel('compose'); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider active:scale-95"
                style={{ background: 'var(--rra-blue)' }}
            >
                <Plus size={13} /> New Message
            </button>
        </div>
    ) : null;

    return (
        <div className="w-full h-[calc(100vh-80px)] flex rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in duration-300">
            {inboxPanel}
            {showCompose ? composePanel : (chatPanel || emptyRight)}
        </div>
    );
};

export default Messages;
