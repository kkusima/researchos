import React, { useState, useEffect, useRef } from 'react'
import { Search, Plus, Check, X, Tag } from 'lucide-react'

export default function TagPicker({
    tags = [],
    assignedTagIds = new Set(),
    onAssign,
    onUnassign,
    onCreate,
    onClose
}) {
    const [search, setSearch] = useState('')
    const [selectedColor, setSelectedColor] = useState('blue')
    const inputRef = useRef(null)
    const containerRef = useRef(null)

    // Colors available for new tags
    const COLORS = [
        { name: 'blue', bg: 'bg-blue-100', text: 'text-blue-700' },
        { name: 'green', bg: 'bg-green-100', text: 'text-green-700' },
        { name: 'red', bg: 'bg-red-100', text: 'text-red-700' },
        { name: 'amber', bg: 'bg-amber-100', text: 'text-amber-700' },
        { name: 'purple', bg: 'bg-purple-100', text: 'text-purple-700' },
        { name: 'pink', bg: 'bg-pink-100', text: 'text-pink-700' },
        { name: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700' },
        { name: 'gray', bg: 'bg-gray-100', text: 'text-gray-700' },
    ]

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus()

        // Click outside handler
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose && onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    )

    const exactMatch = filteredTags.find(t => t.name.toLowerCase() === search.toLowerCase())

    const handleCreate = () => {
        if (!search.trim()) return
        onCreate(search.trim(), selectedColor)
        setSearch('')
    }

    return (
        <div
            ref={containerRef}
            className="absolute right-0 top-8 z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in"
        >
            <div className="p-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search or create tag..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                if (exactMatch) {
                                    if (assignedTagIds.has(exactMatch.id)) onUnassign(exactMatch.id)
                                    else onAssign(exactMatch.id)
                                    setSearch('')
                                } else if (search.trim()) {
                                    handleCreate()
                                }
                            }
                            if (e.key === 'Escape') onClose()
                        }}
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    />
                </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1">
                {filteredTags.length > 0 && (
                    <div className="space-y-0.5">
                        {filteredTags.map(tag => {
                            const isAssigned = assignedTagIds.has(tag.id)
                            // Parse color if it's a JSON string or just use the name for class lookup
                            // We'll assume simple color names for now
                            const colorObj = COLORS.find(c => c.name === tag.color) || COLORS[0]

                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => isAssigned ? onUnassign(tag.id) : onAssign(tag.id)}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors ${isAssigned ? 'bg-gray-50' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorObj.bg} ${colorObj.text}`}>
                                            {tag.name}
                                        </span>
                                    </div>
                                    {isAssigned && <Check className="w-3.5 h-3.5 text-gray-600" />}
                                </button>
                            )
                        })}
                    </div>
                )}

                {!exactMatch && search.trim() && (
                    <div className="mt-2 pt-2 border-t border-gray-100 px-2 pb-2">
                        <div className="text-xs text-gray-500 mb-2">Create "{search}"</div>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {COLORS.map(c => (
                                <button
                                    key={c.name}
                                    onClick={() => setSelectedColor(c.name)}
                                    className={`w-5 h-5 rounded-full ${c.bg} border-2 ${selectedColor === c.name ? 'border-gray-600' : 'border-transparent'}`}
                                />
                            ))}
                        </div>
                        <button
                            onClick={handleCreate}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
                        >
                            <Plus className="w-3 h-3" />
                            Create Tag
                        </button>
                    </div>
                )}

                {filteredTags.length === 0 && !search && (
                    <div className="px-3 py-8 text-center text-xs text-gray-400">
                        No tags found. Type to create one.
                    </div>
                )}
            </div>
        </div>
    )
}
