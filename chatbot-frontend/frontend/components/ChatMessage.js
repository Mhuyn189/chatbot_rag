export default function ChatMessage({role, content, timestamp, sources}) {
    const isUser = role === 'user'

    // Hàm format text đơn giản
    const formatContent = (text) => {
        if (!text || typeof text !== 'string') {
            return ''
        }
        
        // Thay code block ```...``` bằng <pre>
        let formatted = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre class="code-block"><code>${code.trim()}</code></pre>`
        })
        
        // Thay code inline `...` bằng <code>
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>')
        
        // Thay **bold** bằng <strong>
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        
        // Thay bullet point * đầu dòng thành dấu •
        formatted = formatted.replace(/^\* (.+)/gm, '• $1')

        // Thay *italic* bằng <em> (chỉ bắt khi có chữ 2 phía, không phải đầu dòng)
        formatted = formatted.replace(/(?<!\w)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\w)/g, '<em>$1</em>')
        
        // Thay xuống dòng
        formatted = formatted.replace(/\n/g, '<br/>')
        
        return formatted
    }

    // Hàm format thời gian
    const formatTime = (isoString) => {
        if (!isoString) return ''

        try {
            const date = new Date(isoString)

            if (isNaN(date.getTime())) {
                return ''
            }
            
            const hours = date.getHours().toString().padStart(2, '0')
            const minutes = date.getMinutes().toString().padStart(2, '0')

            return `${hours}:${minutes}`
        } catch (error) {
            console.error('Error formatting time: ', error)
            return ''
        }
    }

    return (
        <div className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
        
            {/* Avatar */}
            <div className="w-8 h-8 rounded flex items-center justify-center flext-shrink-0 overflow-hidden">
                <img
                    src={isUser ? '/user.svg': '/bot.svg'}
                    alt={isUser ? 'User' : 'Bot'}
                    className="w-5 h-5"
                />
            </div>
            
            {/* Tin nhắn */}
            <div className={`max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                {/* Tên */}
                <p className="text-xs text-gray-500 mb-1 px-1">
                    {isUser ? 'Bạn' : 'Bot'}
                </p>

                {/* Nội dung */}
                <div className={`p-3 rounded-lg ${
                        isUser 
                            ? 'text-white rounded-tr-none'
                            : 'text-gray-800 rounded-tl-none'
                    }`} 
                    style={
                        isUser 
                            ? {backgroundColor: '#0061BB'} 
                            : {backgroundColor: 'rgb(209, 250, 229)'}}
                >
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{content}</p>
                    ) : (
                        <div 
                            className="message-content"
                            dangerouslySetInnerHTML={{ __html: formatContent(content) }}
                        />
                    )}

                    {!isUser && sources && sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                            <div className="flex items-start gap-2 text-xs text-gray-600">
                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="flex-1">
                                    <span className="font-semibold">
                                        Nguồn:
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {sources.map((source, idx) => (
                                            <span
                                                key={idx}
                                                className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium"
                                            >
                                                {source}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {timestamp && (
                    <p className={`text-xs text-gray-400 mt-1 px-1 ${isUser ? 'text-right': 'text-left'}`}>
                        {formatTime(timestamp)}
                    </p>
                )}

            </div>
        </div>
    )
}