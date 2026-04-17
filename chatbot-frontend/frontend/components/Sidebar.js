import { useState } from "react"

export default function Sidebar({ sessions, currentSession, onSelectSession, onNewSession, onDeleteSession, onRenameSesssion }) {
    const [editingId, setEditingId] = useState(null)  //ID session dang edit
    const [editingName, setEditingName] = useState('') //Ten moi 

    const handelDoubleClick = (session) => {
        setEditingId(session.id)
        setEditingName(session.name)
    }

    const handleKeyPress = (e, sessionId) => {
        if (e.key === 'Enter') {
            if (editingName.trim() !== '') {
                onRenameSesssion(sessionId, editingName.trim())
            }
            setEditingId(null)
        } else if (e.key === 'Escape') {
            setEditingId(null)
        }
    }

    return (
        <div className="w-64 h-screen p-4 flex flex-col" style={{backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0'}}>
            {/*HEADER*/}
            <div className="mb-4">
                <h2 className="text-xl font-bold mb-3" style={{color: '#0061BB'}}>Chatbot</h2>
                
                {/*Nút tạo session mới*/}
                <button
                    onClick={onNewSession}
                    className="w-full text-white py-2 px-4 rounded flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{backgroundColor: '#0061BB'}}
                >
                    <img src="/plus.svg" alt="Tạo mới" className="w-5 h-5 invert"/>
                    <span>Tạo mới</span>
                </button>
            </div>

            {/*Danh sách sessions*/}
            <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center mt-4">
                        Chưa có cuộc hội thoại nào
                    </p>
                ) : (
                    sessions.map((session) => (
                        <div 
                            key={session.id}
                            className={`mb-2 p-3 rounded cursor-pointer flex justify-between items-center group transition-colors`}
                            style={session.id === currentSession
                                ? {backgroundColor: 'rgb(209, 250, 229)', borderLeft: '3px solid #0061BB'}
                                : {backgroundColor: 'transparent'}
                            }
                            onMouseEnter={e => {
                                if (session.id !== currentSession)
                                    e.currentTarget.style.backgroundColor = '#f1f5f9'
                            }}
                            onMouseLeave={e => {
                                if (session.id !== currentSession)
                                    e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                            onClick={() => onSelectSession(session.id)}
                            onDoubleClick={() => handelDoubleClick(session)}
                        >
                            {/*Tên session*/}
                            <div className="flex-1">
                                {editingId === session.id ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={(e) => handleKeyPress(e, session.id)}
                                        onBlur={() => setEditingId(null)} //Click ra ngoai => huy
                                        autoFocus
                                        className="bg-gray-900 text-white px-2 py-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <>
                                        <p 
                                            className="font-medium truncate overflow-hidden w-40" 
                                            style={{
                                                color: session.id === currentSession 
                                                ? '#0061BB'
                                                : '#374151'
                                            }}
                                        >
                                            {session.name}
                                        </p>
                                        <p 
                                            className="text-xs text-gray-300"
                                            style={{color: '#6b7280'}}
                                        >
                                            {session.messageCount} tin nhắn
                                        </p>
                                    </>
                                )}
                            </div>
                            
                            {/*Nut xoa*/}
                            {editingId !== session.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDeleteSession(session.id)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-gray-900 ml-2"
                                >
                                    <img src="/trash.svg" alt="Xóa" className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400 text-center">
                    Tổng: {sessions.length} cuộc hội thoại
                </p>
            </div>
        </div>
    )
}


