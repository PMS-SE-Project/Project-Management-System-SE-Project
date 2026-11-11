import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'

export function DashboardPage() {
  return (
    <section className="page">
      <div className="dashboard-intro">
        <div>
          <p className="eyebrow">Monday, workspace overview</p>
          <h2>Make room for good work<span className="heading-dot">.</span></h2>
          <p className="page-description">A quiet overview for projects, tasks and the people moving them forward.</p>
        </div>
        <Badge tone="neutral">Preview mode</Badge>
      </div>

      <div className="dashboard-grid">
        <Card className="welcome-panel pastel-pink">
          <div className="panel-kicker">Your project space</div>
          <h3>Everything in one lovely place.</h3>
          <p>Connect your workspace data in a later commit to see progress here.</p>
          <span className="panel-sparkle" aria-hidden="true">✦</span>
        </Card>

        <Card className="progress-panel pastel-yellow">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Project progress</span>
              <h3>Waiting for your first project</h3>
            </div>
            <span className="progress-ring" aria-hidden="true">—</span>
          </div>
          <div className="progress-track"><span /></div>
          <p className="panel-footnote">Progress will appear once project data is connected.</p>
        </Card>

        <Card className="metric-card pastel-blue">
          <span className="metric-label">Active projects</span>
          <strong className="metric-value">—</strong>
          <Badge tone="info">No data yet</Badge>
        </Card>
        <Card className="metric-card pastel-mint">
          <span className="metric-label">Pending tasks</span>
          <strong className="metric-value">—</strong>
          <Badge tone="success">No data yet</Badge>
        </Card>
        <Card className="metric-card pastel-neutral">
          <span className="metric-label">Completed tasks</span>
          <strong className="metric-value">—</strong>
          <Badge tone="neutral">No data yet</Badge>
        </Card>

        <Card className="activity-panel">
          <div className="section-heading">
            <div>
              <span className="panel-kicker">Timeline</span>
              <h3>Recent activity</h3>
            </div>
            <span className="section-symbol" aria-hidden="true">↗</span>
          </div>
          <div className="compact-empty">
            <span className="empty-line" aria-hidden="true" />
            <p>Activity updates will show here when your workspace is connected.</p>
          </div>
        </Card>

        <Card className="tasks-panel pastel-neutral">
          <div className="section-heading">
            <div>
              <span className="panel-kicker">Focus list</span>
              <h3>Task overview</h3>
            </div>
            <Badge tone="warning">Coming soon</Badge>
          </div>
          <div className="task-placeholder">
            <span className="task-marker" aria-hidden="true" />
            <span>Tasks will be ready for planning here.</span>
          </div>
          <div className="task-placeholder">
            <span className="task-marker task-marker-blue" aria-hidden="true" />
            <span>Due dates and priorities will appear here.</span>
          </div>
        </Card>
      </div>
    </section>
  )
}
