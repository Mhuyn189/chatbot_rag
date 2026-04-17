'use client'

import { useState, useRef, useEffect } from 'react'
import ChatMessage from '@/components/ChatMessage'
import Sidebar from '@/components/Sidebar'


export default function Home() {
    // Tạo state để lưu danh sách tin nhắn
    const [sessions, setSessions] = useState([])
    const [currentSessionId, setCurrentSessionId] = useState(null)
    const [allMessages, setAllMessages] = useState({})
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef(null)
    const currentMessages = allMessages[currentSessionId] || []

    useEffect(() => {
        loadSessionsFromBackend()
    }, [])

    useEffect(() => {
        if (currentSessionId && currentSessionId.trim() !== '') {
            loadHistoryForSession(currentSessionId)
        }
    }, [currentSessionId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [currentMessages])

    const loadSessionsFromBackend = async () => {
        try {
            const response = await fetch('http://localhost:8000/sessions')
            const data = await response.json()

            if (data.sessions && data.sessions.length > 0) {
                const formattedSessions = data.sessions.map(s => ({
                    id: s.session_id,
                    name: s.session_name,
                    messageCount: s.message_count
                }))
                setSessions(formattedSessions)
                setCurrentSessionId(formattedSessions[0].id)
            } else {
                // ko có session nào -> reset sạch 
                setSessions([])
                setCurrentSessionId(null)
            }
        } catch (error) {
            console.error('Lỗi khi load sessions: ', error)
        }
    }

    const loadHistoryForSession = async (sessionId) => {
        // Kh gọi API nếu sessionId rỗng
        if (!sessionId || sessionId.trim() === '') return 
        try {
            const response = await fetch(`http://localhost:8000/history/${sessionId}`)
            if (!response.ok) return

            const data = await response.json()
            
            if (data.history) {
                const normalizedHistory = data.history.map(msg => ({
                    ...msg,
                    timestamp: normalizeTimestamp(msg.timestamp)
                }))
                setAllMessages(prev => ({
                    ...prev,
                    [sessionId]: normalizedHistory
                }))
            }
        } catch (error) {
            console.error('Lỗi khi load history:', error)
        }
    }

    const normalizeTimestamp = (timestamp) => {
        if (!timestamp) 
            return new Date().toISOString()

        if (timestamp.includes('Z') || timestamp.includes('+'))
            return timestamp
        return timestamp.replace(' ', 'T') + 'Z'
    }

    const handleNewSession = async () => {
        const newId = `session_${Date.now()}`
        const newName = `Cuộc hội thoại ${new Date().toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit' 
        })}`
    

        try {
            const res = await fetch('http://localhost:8000/sessions', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({session_id: newId, session_name: newName})
            })
            if (!res.ok) {
                console.error('Không tạo được session trên backend')
                return 
            }
        } catch(e) {
            console.error('Lỗi tạo session: ', e)
            return 
        }

        const newSession = {id: newId, name: newName, messageCount: 0}
        setSessions(prev => [...prev, newSession])
        setAllMessages(prev => ({...prev, [newId]: [] }))
        setCurrentSessionId(newId)
    }

    const handleSelectSession = (sessionId) => {
        setCurrentSessionId(sessionId)
    }

    const handleDeleteSession = async (sessionId) => {
        if (!sessionId || sessionId.trim() === '') {
            console.error('sessionId rỗng, không thể xóa')
            return 
        }
        
        if (!confirm('Bạn có chắc muốn xóa cuộc hội thoại này?')) {
            return 
        }

        try {
            const res = await fetch(`http://localhost:8000/session/${sessionId}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const err = await res.json()
                console.error('Backend lỗi khi xóa: ', err)
            }
        } catch (e) {
            console.error('Lỗi khi xóa session: ', e)
        }

        const newSessions = sessions.filter(s => s.id !== sessionId)
        setSessions(newSessions)

        const newAllMessages = {...allMessages}
        delete newAllMessages[sessionId]
        setAllMessages(newAllMessages)

        if (currentSessionId === sessionId) {
            const nextSession = newSessions[0]
            setCurrentSessionId(nextSession ? nextSession.id : null)
        }
    }

    const handleRenameSession = (sessionId, newName) => {
        setSessions(sessions.map(s => 
            s.id === sessionId 
                ? {...s, name: newName}
                : s
        ))
    }

    const autoRenameSession = async (sessionId, userMessage, botReply) => {
        try {
            console.log('autoRename gọi với:', { sessionId, userMessage, botReply })
            const res = await fetch('http://localhost:8000/generate-title', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    user_message: userMessage,
                    bot_reply: botReply
                })
            })
            console.log('generate-title status:', res.status)
            if (!res.ok) return 
            
            const data = await res.json()
            console.log('generate-title data:', data)
            console.log('data.title raw:', JSON.stringify(data.title))
            const trimmed = data.title?.trim()
            console.log('trimmed:', trimmed, 'length:', trimmed?.length)
            const newName = trimmed && trimmed.length > 0 ? trimmed.slice(0, 40) : 'Cuộc hội thoại'
            console.log('newName:', newName)
            // Cập nhật lên BE
            await fetch(`http://localhost:8000/sessions/${sessionId}/name`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({session_name: newName})
            })

            // Cập nhật Sidebar
            setSessions(prev => prev.map(s => 
                s.id === sessionId ? {...s, name: newName} : s 
            ))
        } catch (e) {
            console.error('Lỗi tự động đặt tên: ', e)
        }
    }

    const callAPI = async (userMessage) => {
        try {
            console.log('Gọi API với message:', userMessage)
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    message: userMessage 
                })
            });

            if (!response.ok) {
                throw new Error('Lỗi khi gọi API')
            }

            const data = await response.json()
            console.log('Data nhận được:', data)
            return {
                bot_reply: data.bot_reply,
                sources: data.sources || []
            }
        } catch (error) {
        
            console.error('Lỗi: ', error)
            return 'Xin lỗi, đã có lỗi xảy ra'
        }
    }

    const handleSend = async () => {
        if (input.trim() === '' || !currentSessionId) return 

        const userMessage = input 
        
        //Thêm tin nhắn user vào giao diện
        const newUserMsg = {
            role: 'user', 
            content: userMessage,
            timestamp: new Date().toISOString()
        }
        setAllMessages({
            ...allMessages,
            [currentSessionId]: [...currentMessages, newUserMsg]
        })

        setInput('')
        setLoading(true)

        //Gọi API
        const apiResponse = await callAPI(userMessage)

        const newBotMsg = {
            role: 'assistant',
            content: apiResponse.bot_reply,
            timestamp: new Date().toISOString(),
            sources: apiResponse.sources
        }

        console.log('Bot Message:', newBotMsg)
        
        setAllMessages(prev => ({
            ...prev, 
            [currentSessionId]: [...prev[currentSessionId], newBotMsg]
        }))

        setSessions(sessions.map(s =>
            s.id === currentSessionId
                ? { ...s, messageCount: s.messageCount + 2}
                : s
        ))

        //  Tự động đặt tên sau tin nhắn đầu tiên
        const msgCount = sessions.find(s => s.id === currentSessionId)?.messageCount || 0
        console.log('msgCount khi gọi autoRename:', msgCount)
        if (currentMessages.length === 0 && userMessage.trim().length > 5) {
            autoRenameSession(currentSessionId, userMessage, apiResponse.bot_reply)
        }

        setLoading(false)
    }
    
    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <Sidebar 
                sessions={sessions}
                currentSession={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onDeleteSession={handleDeleteSession}
                onRenameSesssion={handleRenameSession}
            />
            
            {/* Main chat area */}
            <div className="flex-1 flex flex-col">
                
                {/* Header */}
                <div className="bg-white border-b p-4 flex justify-between items-center" style={{backgroundColor: '#0061BB'}}>
                    <h1 className="text-xl font-bold text-white">
                        {sessions.find(s => s.id === currentSessionId)?.name || 'Chatbot'}
                    </h1>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {currentMessages.length === 0 && (
                        <p className="text-gray-400 text-center mt-10">
                        Gửi tin nhắn để bắt đầu...
                        </p>
                    )}
                    
                    {currentMessages.map((msg, index) => (
                        <ChatMessage 
                            key={index} 
                            role={msg.role} 
                            content={msg.content} 
                            timestamp={msg.timestamp}
                            sources={msg.sources}
                        />
                    ))}
                    
                    {loading && (
                        <div className="p-3 mb-2 bg-gray-100 rounded max-w-[80%]">
                        <p className="text-gray-500">Đang trả lời...</p>
                        </div>
                    )}
                
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Input */}
                <div className="border-t bg-white p-4">
                    <div className="flex gap-2 max-w-4xl mx-auto">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
                            placeholder="Nhập tin nhắn..."
                            className='p-3 flex-1 rounded-full focus:outline-none focus:ring-2 transition-shadow'
                            style={{
                                boder: '1.5px solid #cbd5e1',
                                backgroundColor: '#f8fafc'
                            }}
                            onFocus={e => e.target.style.borderColor = '#0061BB'}
                            onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                            disabled={loading}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={loading}
                            className={`px-6 rounded-full font-medium ${
                                loading 
                                ? 'bg-gray-300 cursor-not-allowed' 
                                : 'text-white hover:opacity-90 transition-opacity'
                            }`}
                            style={!loading && currentSessionId ? {backgroundColor: '#0061BB'} : {}}
                        >
                            {loading ? 'Đang gửi...' : 'Gửi'}
                        </button>
                    </div>
                </div>
                
            </div>
        </div>
    )
}
