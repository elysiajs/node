import { serve } from 'srvx'
import { createNodeAdapter } from './adapter'

export const node = () => createNodeAdapter(serve)

export default node
