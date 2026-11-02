import { useState } from 'react'
import type { Fragrance, ShelfItem } from './types'

const key = 'sillage-shelf-v1'

function readShelf(): ShelfItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (item): item is ShelfItem =>
          item &&
          typeof item.id === 'string' &&
          /^[a-f0-9]{16}$/.test(item.id) &&
          typeof item.name === 'string' &&
          typeof item.brand === 'string' &&
          ['saved', 'liked', 'disliked'].includes(item.preference) &&
          Array.isArray(item.accords) &&
          item.notes &&
          ['top', 'middle', 'base'].every((layer) =>
            Array.isArray(item.notes[layer]),
          ),
      )
      .slice(0, 50)
  } catch {
    return []
  }
}

export function useShelf() {
  const [shelf, setShelf] = useState<ShelfItem[]>(readShelf)
  const [storageError, setStorageError] = useState('')
  function updateShelf(next: ShelfItem[]) {
    setShelf(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setStorageError('')
    } catch {
      setStorageError(
        'Browser storage is unavailable. Your shelf will last for this visit only.',
      )
    }
  }

  function save(fragrance: Fragrance, preference: ShelfItem['preference']) {
    const existing = shelf.find((item) => item.id === fragrance.id)
    const rest = shelf.filter((item) => item.id !== fragrance.id)
    updateShelf(
      existing?.preference === preference
        ? rest
        : [...rest, { ...fragrance, preference }].slice(-50),
    )
  }

  return {
    shelf,
    save,
    storageError,
    remove: (id: string) => updateShelf(shelf.filter((item) => item.id !== id)),
  }
}
