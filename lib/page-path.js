// Where a page is. The host keeps the home page under the name "/index", and a home page it renders
// again after its hour believes that is its address (seen 2026-11-10, also on deployments a day
// old): the layout's header then showed on the home page in addition to the page's own, and in the
// app no tab was marked. Whatever asks where it is asks here, and the home page is "/".
import { usePathname } from 'next/navigation'

export const pagePath = path => (path === '/index' ? '/' : path)
export const usePagePath = () => pagePath(usePathname())
