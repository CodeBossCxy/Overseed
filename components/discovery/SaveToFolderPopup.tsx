'use client'

import { useState, useEffect } from 'react'

interface Folder {
  id: string
  name: string
  count: number
}

interface SaveToFolderPopupProps {
  open: boolean
  onClose: () => void
  onSelect: (folderId: string | null, folderName: string | null) => void
  zh: boolean
}

export default function SaveToFolderPopup({ open, onClose, onSelect, zh }: SaveToFolderPopupProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    fetch('/api/saved-creators/folders')
      .then(res => res.ok ? res.json() : { folders: [] })
      .then(data => setFolders(data.folders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  const createFolder = async () => {
    const name = newName.trim()
    if (!name || createBusy) return
    setCreateBusy(true)
    setError('')
    try {
      const res = await fetch('/api/saved-creators/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || 'Failed')
      onSelect(data.folder.id, data.folder.name)
      setNewName('')
      setCreating(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreateBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={onClose}>
      <div
        data-solid
        className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 w-full max-w-sm mx-4 overflow-hidden"
        style={{ backgroundColor: 'white' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-base font-bold text-gray-900">
            {zh ? '保存到文件夹' : 'Save to folder'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {zh ? '选择一个文件夹来整理你收藏的创作者' : 'Choose a folder to organize your saved creators'}
          </p>
        </div>

        {/* Folder list */}
        <div className="px-3 max-h-[240px] overflow-y-auto">
          {/* No folder option */}
          <button
            type="button"
            onClick={() => onSelect(null, null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">{zh ? '不选文件夹' : 'No folder'}</p>
              <p className="text-[11px] text-gray-400">{zh ? '直接保存到收藏' : 'Save to collection directly'}</p>
            </div>
          </button>

          {loading ? (
            <div className="py-4 text-center text-xs text-gray-400">{zh ? '加载中...' : 'Loading...'}</div>
          ) : (
            folders.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id, f.name)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 truncate">{f.name}</p>
                  <p className="text-[11px] text-gray-400">{f.count} {zh ? '位创作者' : 'creators'}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Create new folder */}
        <div className="px-5 py-3 border-t border-gray-100">
          {creating ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createFolder()}
                placeholder={zh ? '文件夹名称' : 'Folder name'}
                maxLength={40}
                autoFocus
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={createFolder}
                disabled={!newName.trim() || createBusy}
                className="px-3 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50"
              >
                {createBusy ? '...' : (zh ? '创建' : 'Create')}
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setNewName(''); setError('') }}
                className="px-2 py-2 text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-xl transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {zh ? '新建文件夹' : 'Create new folder'}
            </button>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}
