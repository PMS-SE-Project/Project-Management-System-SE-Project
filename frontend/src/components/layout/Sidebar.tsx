import { NavLink, type NavLinkRenderProps } from 'react-router-dom'

const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '⌂', end: true },
  { label: 'Projects', path: '/projects', icon: '▦', end: false },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">P</span>
        <span>ProjectHub</span>
      </div>
      <nav aria-label="Primary navigation">
        {navigationItems.map((item) => (
          <NavLink
            className={({ isActive }: NavLinkRenderProps) =>
              `nav-item${isActive ? ' nav-item-active' : ''}`
            }
            end={item.end}
            key={item.path}
            to={item.path}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="status-dot" aria-hidden="true" />
        <span>Workspace online</span>
      </div>
    </aside>
  )
}
