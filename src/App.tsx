import { type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Button, EmptyState, Spinner } from './components/kit'
import { homeFor, useAuth } from './lib/auth'
import type { Role } from './lib/types'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import CustomerHome from './pages/CustomerHome'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
import OrdersPage from './pages/OrdersPage'
import OwnerDashboard from './pages/OwnerDashboard'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import RestaurantDetail from './pages/RestaurantDetail'
import RiderDashboard from './pages/RiderDashboard'
import AdminDashboard from './pages/AdminDashboard'

function NotFound() {
  return (
    <AppShell>
      <EmptyState
        title="Page not found"
        message="That link does not exist in Swad MH13."
        action={
          <Link to="/">
            <Button>Back to restaurants</Button>
          </Link>
        }
      />
    </AppShell>
  )
}

/** Blocks a route until the visitor is signed in with the required role. */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, role: current, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Checking your session…" />
      </AppShell>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (current && current !== role) {
    return <Navigate to={homeFor(current)} replace />
  }

  return <>{children}</>
}

/** Signed-in users skip the login/register screens. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth()
  if (loading) {
    return (
      <AppShell>
        <Spinner label="Checking your session…" />
      </AppShell>
    )
  }
  if (user) return <Navigate to={homeFor(role)} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerHome />} />
      <Route path="/restaurants/:id" element={<RestaurantDetail />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route
        path="/orders"
        element={
          <RequireRole role="customer">
            <OrdersPage />
          </RequireRole>
        }
      />

      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/owner"
        element={
          <RequireRole role="restaurant_owner">
            <OwnerDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/rider"
        element={
          <RequireRole role="rider">
            <RiderDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminDashboard />
          </RequireRole>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
