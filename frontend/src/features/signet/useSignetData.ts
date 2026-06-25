import { useState, useEffect, useCallback } from 'react'
import type { SignetNode, SignetEdge, ActivityItem, ReviewItem } from '@/features/signet/types'
import { fetchAllSignetData, fetchCollectionStatus, type SignetCollectionStatus } from '@/api/signet'

interface SignetData {
  nodes: SignetNode[]
  edges: SignetEdge[]
  activity: ActivityItem[]
  reviews: ReviewItem[]
  collectionStatus: SignetCollectionStatus | null
  isLoading: boolean
  isLive: boolean
  reload: () => Promise<void>
}

export function useSignetData(): SignetData {
  const [data, setData] = useState<Omit<SignetData, 'reload'>>({
    nodes: [],
    edges: [],
    activity: [],
    reviews: [],
    collectionStatus: null,
    isLoading: true,
    isLive: false,
  })

  const loadData = useCallback(async () => {
    try {
      const [apiData, collectionStatus] = await Promise.all([
        fetchAllSignetData(),
        fetchCollectionStatus(),
      ])
      setData({
        nodes: apiData.accounts,
        edges: apiData.edges,
        activity: apiData.activity,
        reviews: apiData.reviews,
        collectionStatus,
        isLoading: false,
        isLive: collectionStatus.is_collecting,
      })
    } catch {
      setData(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!data.collectionStatus?.is_collecting) return undefined
    const timer = window.setInterval(() => {
      void loadData()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [data.collectionStatus?.is_collecting, loadData])

  return { ...data, reload: loadData }
}
