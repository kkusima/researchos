function formatRelativeDate(dateString) {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatModifiedBy(dateString, modifiedByName, currentUserName) {
  if (!dateString) return null
  const relativeTime = formatRelativeDate(dateString)
  if (modifiedByName && modifiedByName !== currentUserName) {
    const firstName = modifiedByName.split(' ')[0].split('@')[0]
    return `${relativeTime} by ${firstName}`
  }
  return relativeTime
}

const now = new Date()
const m57 = new Date(now.getTime() - 57 * 60000).toISOString()
const m0 = new Date(now.getTime()).toISOString()
const h2 = new Date(now.getTime() - 2 * 3600000).toISOString()
const d3 = new Date(now.getTime() - 3 * 24 * 3600000).toISOString()

console.log('57m ago no name:', formatModifiedBy(m57))
console.log('57m ago with name:', formatModifiedBy(m57, 'Alice Johnson', 'Bob'))
console.log('now:', formatModifiedBy(m0, 'Alice Johnson', 'Alice Johnson'))
console.log('2h ago with name:', formatModifiedBy(h2, 'charlie@example.com', 'Bob'))
console.log('3d ago:', formatModifiedBy(d3))
console.log('null date:', formatModifiedBy(null, 'Alice', 'Bob'))
