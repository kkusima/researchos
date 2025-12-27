import React, { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

// Lightweight avatar with upload for non-OAuth users.
export default function Avatar({ size = 32, className = '' }) {
  const { user } = useAuth()

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={userName} className={`rounded-full`} style={{ width: size, height: size, objectFit: 'cover' }} />
      ) : (
        <div
          className="avatar bg-gray-500"
          style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size / 2.5)) }}
        >
          {userName[0]?.toUpperCase()}
        </div>
      )}
    </div>
  )
}
