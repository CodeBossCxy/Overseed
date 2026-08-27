import Header from './Header'
import Footer from './Footer'
import CreateCampaignFAB from './CreateCampaignFAB'
import BetaBanner from './BetaBanner'

export default function MainLayout({
  children,
  noFooter,
  hideFooter,
}: {
  children: React.ReactNode
  noFooter?: boolean
  hideFooter?: boolean
}) {
  return (
    <div className={`flex flex-col ${noFooter ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <BetaBanner />
      <Header />
      <main className={noFooter ? 'flex-1 overflow-hidden' : 'flex-grow'}>
        {children}
      </main>
      {!noFooter && !hideFooter && <Footer />}
      <CreateCampaignFAB />
    </div>
  )
}
