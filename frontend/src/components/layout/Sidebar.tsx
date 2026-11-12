import { NavLink, type NavLinkRenderProps } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

interface SidebarProps {
  isOpen: boolean
  onNavigate: () => void
}

const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '⌂', end: true },
  { label: 'Projects', path: '/projects', icon: '▦', end: false },
]

export function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  const { session } = useAuth()
  const visibleNavigationItems = session?.user.role === 'admin'
    ? [...navigationItems, { label: 'Admin', path: '/admin/users', icon: '⚙', end: false }]
    : navigationItems

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">P</span>
        <span>ProjectHub</span>
      </div>
      <nav id="primary-navigation" aria-label="Primary navigation">
        {visibleNavigationItems.map((item) => (
          <NavLink
            className={({ isActive }: NavLinkRenderProps) =>
              `nav-item${isActive ? ' nav-item-active' : ''}`
            }
            end={item.end}
            key={item.path}
            to={item.path}
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-footer-mark" aria-hidden="true">+</span>
        <span>More workspace tools soon</span>
      </div>
    </aside>
  )
}
