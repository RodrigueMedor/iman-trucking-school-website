import { pageTitles } from '../navigation'

export const contentPages = Object.entries(pageTitles).map(([path, label]) => ({
  path,
  value: path === '/' ? 'home' : path.replace(/^\/|\/$/g, ''),
  label,
}))
