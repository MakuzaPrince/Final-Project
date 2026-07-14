import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import {
    Search, Send, MessageSquare, X, ArrowLeft,
    Loader2, Plus, Clock, Shield
} from 'lucide-react';

const API = 'http://localhost:5000/api/messages';
const getHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

const fmtTime = (date) => {
    if (!date) return '';
    const d = new Date(date), now = new Date(), diff = (now - d) / 1000;
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const roleColor = (role) => role === 'driver' ? '#059669' : '#1E6BB5';

// ── All sub-components defined OUTSIDE the parent ────────────────────────────

const MsgAvatar = ({ user, size = 38 }) => {
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

const Bubble = ({ msg, myId }) => {
    const senderId = String(msg.sender?._id || msg.sender);
    const isMe = senderId === String(myId);
    return (
        <div className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            {!isMe && <MsgAvatar user={msg.sender} size={28} />}
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
            {isMe && <MsgAvatar user={msg.sender} size={28} />}
        </div>
    );
};

const ConvRow = ({ conv, selected, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
            selected ? 'bg-rra-blue/5 dark:bg-rra-blue/10 border-l-[3px] border-l-rra-blue pl-[13px]' : ''
        }`}
    >
        <MsgAvatar user={conv.user} size={40} />
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{conv.user.fullName}</p>
                <span className="text-[10px] text-gray-400 ml-2 shrink-0">{fmtTime(conv.lastMessage?.createdAt)}</span>
            </div>
            <p className="text-xs text-gray-400 truncate">{conv.lastMessage?.subject || '–'}</p>
            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                conv.user.role === 'driver'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>{conv.user.role}</span>
        </div>
        {conv.unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-black flex items-center justify-center px-1 shrink-0"
                style={{ background: 'var(--rra-blue)' }}>{conv.unreadCount}</span>
        )}
    </button>
);

const UserPickRow = ({ user, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 text-left"
    >
        <MsgAvatar user={user} size={34} />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user.email} · {user.role}</p>
        </div>
    </button>
);

// ── Main admin messages component ─────────────────────────────────────────────
const AdminMessages = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const { showToast } = useDialog();

    const [conversations, setConversations] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [sending, setSending] = useState(false);
    const [showCompose, setShowCompose] = useState(false);

    // mobile: 'list' | 'compose' | 'chat'
    const [mobilePanel, setMobilePanel] = useState('list');

    const [searchTerm, setSearchTerm] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [newRecipient, setNewRecipient] = useState(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    const bottomRef = useRef(null);

    const loadConversations = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API}/admin/conversations`, { headers: getHeaders() });
            setConversations(data);
        } catch (e) { console.error(e); }
        finally { setLoadingConvs(false); }
    }, []);

    const loadUsers = useCallback(async (q = '') => {
        try {
            const { data } = await axios.get(`${API}/admin/users`, { params: { search: q }, headers: getHeaders() });
            setAllUsers(data);
        } catch (e) {}
    }, []);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    useEffect(() => {
        if (showCompose) loadUsers(userSearch);
    }, [showCompose, userSearch, loadUsers]);

    const openConversation = useCallback(async (targetUser) => {
        setSelectedUser(targetUser);
        setShowCompose(false);
        setMobilePanel('chat');
        setLoadingMsgs(true);
        setMessages([]);
        try {
            const { data } = await axios.get(`${API}/conversation/${targetUser._id}`, { headers: getHeaders() });
            setMessages(data);
            loadConversations();
        } catch (e) { console.error(e); }
        finally { setLoadingMsgs(false); }
    }, [loadConversations]);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        if (!socket) return;
        const handle = (msg) => {
            const sid = String(msg.sender?._id || msg.sender);
            if (selectedUser && sid === String(selectedUser._id)) {
                setMessages(prev => [...prev, msg]);
            }
            loadConversations();
        };
        socket.on('newMessage', handle);
        return () => socket.off('newMessage', handle);
    }, [socket, selectedUser, loadConversations]);

    const sendMessage = async (e) => {
        e.preventDefault();
        const recipient = showCompose ? newRecipient : selectedUser;
        if (!recipient || !subject.trim() || !body.trim()) return;
        setSending(true);
        try {
            const { data } = await axios.post(API, {
                recipientId: recipient._id,
                subject: subject.trim(),
                body: body.trim()
            }, { headers: getHeaders() });

            if (showCompose) {
                await openConversation(recipient);
            } else {
                setMessages(prev => [...prev, data]);
            }
            setSubject('');
            setBody('');
            setNewRecipient(null);
            setShowCompose(false);
            loadConversations();
        } catch (e) {
            showToast(e.response?.data?.message || 'Failed to send', 'error');
        } finally {
            setSending(false);
        }
    };

    const filteredConvs = conversations.filter(c =>
        c.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── inlined JSX panels ────────────────────────────────────────────────────

    const listPanel = (
        <div className={`${mobilePanel !== 'list' ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[280px] xl:w-[300px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-full`}>
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare size={15} className="text-rra-blue" />
                        <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Messages</span>
                    </div>
                    <button
                        onClick={() => { setShowCompose(true); setSelectedUser(null); setMessages([]); setMobilePanel('compose'); loadUsers(); }}
                        className="p-1.5 rounded-xl text-white hover:opacity-90 active:scale-95"
                        style={{ background: 'var(--rra-blue)' }}
                    ><Plus size={14} /></button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20 border border-gray-200 dark:border-gray-700"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {loadingConvs ? (
                    <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-rra-blue" /></div>
                ) : filteredConvs.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <MessageSquare size={26} className="mx-auto text-gray-200 dark:text-gray-600 mb-2" />
                        <p className="text-xs font-bold text-gray-400">No conversations</p>
                    </div>
                ) : (
                    filteredConvs.map(c => (
                        <ConvRow
                            key={c.userId}
                            conv={c}
                            selected={selectedUser?._id === c.userId}
                            onClick={() => openConversation(c.user)}
                        />
                    ))
                )}
            </div>
        </div>
    );

    const composePanel = showCompose ? (
        <div className={`${mobilePanel !== 'compose' ? 'hidden lg:flex' : 'flex'} flex-1 flex-col bg-white dark:bg-gray-900 h-full`}>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
                <button onClick={() => { setShowCompose(false); setMobilePanel('list'); }}
                    className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 lg:hidden"><ArrowLeft size={16} /></button>
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide flex-1">New Message</h3>
                <button onClick={() => setShowCompose(false)}
                    className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hidden lg:flex"><X size={15} /></button>
            </div>
            <form onSubmit={sendMessage} className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">To</label>
                    {newRecipient ? (
                        <div className="flex items-center gap-3 p-3 bg-rra-blue/5 dark:bg-rra-blue/10 border border-rra-blue/20 rounded-xl">
                            <MsgAvatar user={newRecipient} size={30} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{newRecipient.fullName}</p>
                                <p className="text-xs text-gray-400">{newRecipient.email}</p>
                            </div>
                            <button type="button" onClick={() => setNewRecipient(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>
                    ) : (
                        <div>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                                <input type="text" placeholder="Search users..." value={userSearch}
                                    onChange={e => { setUserSearch(e.target.value); loadUsers(e.target.value); }}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20" />
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl max-h-44 overflow-y-auto">
                                {allUsers.length === 0
                                    ? <p className="text-center text-xs text-gray-400 py-4">No users found</p>
                                    : allUsers.map(u => <UserPickRow key={u._id} user={u} onClick={() => { setNewRecipient(u); setUserSearch(''); }} />)}
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Subject</label>
                    <input type="text" placeholder="Subject..." value={subject} onChange={e => setSubject(e.target.value)} required
                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20" />
                </div>
                <div className="flex-1 flex flex-col">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Message</label>
                    <textarea placeholder="Write your message..." value={body} onChange={e => setBody(e.target.value)} required
                        className="flex-1 min-h-[120px] px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20 resize-none" />
                </div>
                <button type="submit" disabled={sending || !newRecipient}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-black uppercase tracking-wider active:scale-95 disabled:opacity-60"
                    style={{ background: 'var(--rra-blue)' }}>
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {sending ? 'Sending...' : 'Send Message'}
                </button>
            </form>
        </div>
    ) : null;

    const chatPanel = selectedUser && !showCompose ? (
        <div className={`${mobilePanel !== 'chat' ? 'hidden lg:flex' : 'flex'} flex-1 flex-col min-w-0 bg-white dark:bg-gray-900 h-full`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
                <button onClick={() => setMobilePanel('list')} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 lg:hidden"><ArrowLeft size={16} /></button>
                <MsgAvatar user={selectedUser} size={36} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">{selectedUser.fullName}</p>
                    <p className="text-xs text-gray-400 capitalize truncate">{selectedUser.role} · {selectedUser.email}</p>
                </div>
            </div>

            {/* Scrollable messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
                {loadingMsgs ? (
                    <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-rra-blue" /></div>
                ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-8">No messages yet — send the first one</p>
                ) : (
                    messages.map(msg => <Bubble key={msg._id} msg={msg} myId={user?._id} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Reply composer — INLINED, no inner component function */}
            <form
                onSubmit={sendMessage}
                className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2 shrink-0"
            >
                <input
                    type="text"
                    placeholder="Subject..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rra-blue focus:ring-1 focus:ring-rra-blue/30"
                />
                <div className="flex gap-2">
                    <textarea
                        placeholder="Write a reply... (Enter ↵ to send)"
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        rows={2}
                        required
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rra-blue focus:ring-1 focus:ring-rra-blue/30 resize-none"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                    />
                    <button
                        type="submit"
                        disabled={sending}
                        className="px-3 rounded-xl text-white font-black active:scale-95 disabled:opacity-60 flex items-center justify-center shrink-0 self-stretch"
                        style={{ background: 'var(--rra-blue)' }}
                    >
                        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                </div>
                <p className="text-[10px] text-gray-400">Enter to send · Shift+Enter for new line</p>
            </form>
        </div>
    ) : null;

    const emptyRight = !showCompose && !selectedUser ? (
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-950">
            <div className="w-16 h-16 rounded-full bg-rra-blue/10 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-rra-blue" />
            </div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">Admin Messaging</h3>
            <p className="text-xs text-gray-400 max-w-xs mb-5">Select a conversation or compose a new message.</p>
            <button onClick={() => { setShowCompose(true); loadUsers(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider active:scale-95"
                style={{ background: 'var(--rra-blue)' }}>
                <Plus size={13} /> New Message
            </button>
        </div>
    ) : null;

    return (
        <div className="w-full h-[calc(100vh-80px)] flex rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in duration-300">
            {listPanel}
            {composePanel || chatPanel || emptyRight}
        </div>
    );
};

export default AdminMessages;
