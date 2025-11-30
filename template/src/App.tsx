import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'
import { SignInForm } from '@/components/auth/SignInForm'
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AuthLoading>
      
      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center p-4">
          <SignInForm />
        </div>
      </Unauthenticated>
      
      <Authenticated>
        <main className="container mx-auto p-4">
          <h1 className="text-3xl font-bold mb-4">Welcome to your app!</h1>
          <p className="text-muted-foreground">
            You are now signed in. Start building your application.
          </p>
        </main>
      </Authenticated>
      
      <Toaster />
    </div>
  )
}

export default App
