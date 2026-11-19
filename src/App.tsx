import { Link, Route, Routes } from 'react-router-dom'
import CustomerLayout from './components/CustomerLayout'
import PanelLayout from './components/PanelLayout'
import Home from './pages/Home'
import RestaurantPage from './pages/RestaurantPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrdersPage from './pages/OrdersPage'
import TrackPage from './pages/TrackPage'
import PanelsPage from './pages/PanelsPage'
import OwnerPanel from './pages/OwnerPanel'
import RiderPanel from './pages/RiderPanel'
import AdminPanel from './pages/AdminPanel'
import { EmptyState } from './components/ui'

function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <EmptyState
        emoji="🧭"
        title="Page not found"
        body="That page does not exist in Swad MH13."
        action={
          <Link
            to="/"
            className="inline-flex rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Back to home
          </Link>
        }
      />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/restaurant/:id" element={<RestaurantPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/track/:id" element={<TrackPage />} />
      </Route>

      <Route element={<PanelLayout />}>
        <Route path="/panels" element={<PanelsPage />} />
        <Route path="/owner" element={<OwnerPanel />} />
        <Route path="/rider" element={<RiderPanel />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
