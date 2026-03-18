import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/ui/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar />
          <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#F7F6F2' }}>
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
