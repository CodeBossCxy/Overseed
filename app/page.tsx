import MainLayout from '@/components/MainLayout'
import HomePage from '@/components/HomePage'

export default function Page() {
  return (
    <MainLayout hideFooter>
      <HomePage />
    </MainLayout>
  )
}
