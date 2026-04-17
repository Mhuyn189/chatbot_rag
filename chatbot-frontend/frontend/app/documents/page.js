'use client'

import {useState, useEffect} from 'react'
import Link from 'next/link'

export default function DocumentsPage() { 
    const [documents, setDocuments] = useState([])
    const [stats, setStats] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadMessage, setUploadMessage] = useState('')


    // Load documents khi trang load
    useEffect(() => {
        loadDocuments()
        loadStats()
    }, [])


    const loadDocuments = async () => {
        try {
            const response = await fetch('http://localhost:8000/documents')
            const data = await response.json()
            setDocuments(data.documents || [])
        } catch (error) {
            console.error('Lỗi khi load documents: ', error)
        } finally {
            setLoading(false)
        }
    }

    const loadStats = async () => {
        try { 
            const response = await fetch('http://localhost:8000/documents/stats')
            const data = await response.json()
            setStats(data)
        } catch (error) {
            console.error('Lỗi khi load stats: ', error)
        }
    }

    const handleUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return 

        if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
            setUploadMessage('Chỉ hỗ trợ file PDF hoặc TXT')
            return
        }

        setUploading(true)
        setUploadMessage('Đang upload...')

        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('http://localhost:8000/documents/upload', {
                method: 'POST',
                body: formData 
            })
            const data = await res.json()

            if (res.ok) {
                setUploadMessage(`${data.message} (${data.chunk_count} chunks)`)
                loadDocuments()
                loadStats()
            } else {
                setUploadMessage(`Lỗi: ${data.detail}`)
            }

        } catch (error) {
            setUploadMessage('Lỗi kết nối đến server')
        } finally {
            setUploading(false)
            e.target.value = ''
        }
        
    }

    const handleDelete = async (filename) => {
        if (!confirm('Bạn có chắc muốn xóa "${filename}"?\n\nSau khi xóa, chatbot không thể trả lời câu hỏi về tài liệu này nữa.')) {
            return
        }

        try {
            const response = await fetch(`http://localhost:8000/documents/${encodeURIComponent(filename)}`, {
                method: 'DELETE'    
            })

            if (response.ok) {
                alert(`Đã xóa "${filename}" thành công!`)
                // Reload lại danh sách
                loadDocuments()
                loadStats()
            } else {
                const error = await response.json()
                alert(`Lỗi: ${error.detail}`)
            }
        } catch (error) {
            console.error('Lỗi khi xóa document: ', error)
            alert('Có lỗi xảy ra khi xóa document')
        }
    }

    return (
        <div className='min-h-screen bg-gray-50'>
            {/*Header*/}
            <div className='bg-white shadow'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='flex justify-between items-center'>
                        <div>
                            <h1 className='text-3xl font-bold text-gray-900'>
                                Quản lý Documents
                            </h1>
                            <p className='mt-1 text-sm text-gray-600'>
                                Danh sách tài liệu đang được sử dụng
                            </p>
                        </div>
                        <div className='flex items-center gap-3'>
                            {uploadMessage && (
                                <span className={`text-sm flex items-center gap-1 ${
                                    uploadMessage.includes('Lỗi') ? 'text-red-600' : 'text-green-600'
                                }`}>
                                    <img
                                        src={uploadMessage.includes('Lỗi') ? '/x.svg' : '/plus.svg'}
                                        className='w-4 h-4'
                                    />
                                    {uploadMessage}
                                </span>
                            )}
                            <label className={`px-4 py-2 rounded-full cursor-pointer text-white transition-opacity flex items-center gap-2 ${
                                uploading ? 'bg-gray-400 cursor-not-allowed' : 'hover: opacity-90'
                            }`}
                            style={!uploading ? {backgroundColor: '#0061BB'} : {}}
                            >
                                <img src='/upload.svg' className='w-4 h-4 invert'/>
                                <span>{uploading ? 'Đang upload...' : 'Upload PDF'}</span>
                                <input
                                    type='file'
                                    accept='.pdf, .txt'
                                    onChange={handleUpload}
                                    disabled={uploading}
                                    className='hidden'
                                />
                            </label>
                            <Link
                                href="/"
                                className='px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity flex items-center gap-2'
                                style={{backgroundColor: '#0061BB'}}
                            >
                                Về Chat 
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/*Stats Cards*/}
            {stats && (
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <div className='bg-white p-6 rounded-lg shadow'>
                            <div className='text-sm text-gray-600'>
                                Tổng số chunks
                            </div>
                            <div className='text-3xl font-bold text-blue-600 mt-2'>
                                {stats.total_points}
                            </div>
                        </div>
                        <div className='bg-white p-6 rounded-lg shadow'>
                            <div className='text-sm text-gray-600'>
                                Vector dimension
                            </div>
                            <div className='text-3xl font-bold text-green-600 mt-2'>
                                {stats.vector_size}
                            </div>
                        </div>
                        <div className='bg-white p-6 rounded-lg shad0w'>
                            <div className='text-sm text-gray-600'>
                                Distance metric
                            </div>
                            <div className='text-3xl font-bold text-purple-600 mt-2'>
                                {stats.distance}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/*Documents List*/}
            <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                <div className='bg-white shadow rounded-lg'>
                    <div className='px-6 py-4 border-b border-gray-200'>
                        <h2 className='text-xl font-semibold text-gray-800'>
                            Documents ({documents.length})
                        </h2>
                    </div>
                    
                    {loading ? (
                        <div className='p-8 text-center text-gray-500'>
                            Loading...
                        </div>
                    ) : documents.length === 0 ? (
                        <div className='p-8 text-center'>
                            <svg className='mx-auto h-12 w-12 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            <p className='mt-4 text-gray-600'>Chưa rõ document nào</p>
                            <p className='mt-2 text-sm text-gray-500'>
                                Thêm file .pdf hoặc .txt vào thư mục backend/documents/ và chạy init_rag.py
                            </p>
                        </div>
                    ) : (
                        <div className='divide-y divide-gray-200'>
                            {documents.map((doc, index) => (
                                <div
                                    key={index}
                                    className='px-6 py-4 hover:bg-gray-50 transition-colors'
                                >
                                    <div className='flex items-center justify-between'>
                                        <div className='flex items-center space-x-4'>
                                            {/*Icon*/}
                                            <div className='flex-shrink-0'>
                                                <svg className='h-10 w-10 text-blue-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                            </div>

                                            {/*Info*/}
                                            <div>
                                                <h3 className='text-lg font-medium text-gray-900'>
                                                    {doc.source}
                                                </h3>
                                                <p className='text-sm text-gray-500'>
                                                    {doc.chunk_count} chunks
                                                </p>
                                            </div>
                                        </div>

                                        {/*Actions*/}
                                        <button
                                            onClick={() => handleDelete(doc.source)}
                                            className='px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors'
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}