import { createContext, useContext, useState, useEffect } from 'react'
import { authMe, authLogin, authLogout, authRegister } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authMe()
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await authLogin({ email, password })
    setUser(data.user)
    return data.user
  }

  const register = async (business_name, email, password) => {
    const { data } = await authRegister({ business_name, email, password })
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    await authLogout()
    setUser(null)
  }

  const refreshUser = async () => {
    const { data } = await authMe()
    setUser(data.user)
    return data.user
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
