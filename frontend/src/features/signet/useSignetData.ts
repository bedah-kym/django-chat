import { useState, useEffect, useCallback } from 'react'
import type { SignetNode, SignetEdge, ActivityItem, ReviewItem } from '@/features/signet/types'
import { fetchAllSignetData } from '@/api/signet'

interface SignetData {
  nodes: SignetNode[]
  edges: SignetEdge[]
  activity: ActivityItem[]
  reviews: ReviewItem[]
  isLoading: boolean
  isLive: boolean
}

export function useSignetData(): SignetData {
  const [data, setData] = useState<SignetData>({
    nodes: [],
    edges: [],
    activity: [],
    reviews: [],
    isLoading: true,
    isLive: false,
  })

  const loadData = useCallback(async () => {
    try {
      const apiData = await fetchAllSignetData()
      setData({
        nodes: apiData.accounts,
        edges: apiData.edges,
        activity: apiData.activity,
        reviews: apiData.reviews,
        isLoading: false,
        isLive: true,
      })
    } catch {
      setData(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return data
}
