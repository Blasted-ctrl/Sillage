import { Bookmark, Check, Layers3, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { Fragrance, Match, ShelfItem } from '../types'

function title(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function FragranceCard({
  fragrance,
  index,
  preference,
  onSave,
  comparing,
  onCompare,
  comparisonFull,
}: {
  fragrance: Match
  index: number
  preference?: ShelfItem['preference']
  onSave: (item: Fragrance, preference: ShelfItem['preference']) => void
  comparing: boolean
  onCompare: () => void
  comparisonFull: boolean
}) {
  return (
    <article className="fragrance-card">
      <span className="catalogue-index" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="fragrance-identity">
        <div className="card-top">
          <span className="brand">{title(fragrance.brand)}</span>
        </div>
        <h3>{title(fragrance.name)}</h3>
        <p className="card-category">
          {fragrance.gender === 'men'
            ? 'Marketed for men'
            : fragrance.gender === 'women'
              ? 'Marketed for women'
              : 'Unisex'}
        </p>
      </div>
      <div className="fragrance-profile">
        <div className="accords" aria-label="Main accords">
          {fragrance.accords.slice(0, 3).map((accord) => (
            <span key={accord}>{accord}</span>
          ))}
        </div>
        <dl className="note-preview">
          <div>
            <dt>Opening</dt>
            <dd>
              {fragrance.notes.top.slice(0, 2).join(', ') || 'Not listed'}
            </dd>
          </div>
          <div>
            <dt>Dry-down</dt>
            <dd>
              {fragrance.notes.base.slice(0, 2).join(', ') || 'Not listed'}
            </dd>
          </div>
        </dl>
      </div>
      <div className="card-actions">
        <button
          className="compare-button"
          aria-pressed={comparing}
          disabled={comparisonFull && !comparing}
          onClick={onCompare}
        >
          {comparing ? <Check size={15} /> : <Layers3 size={15} />}{' '}
          {comparing ? 'Comparing' : 'Compare'}
        </button>
        <div className="taste-actions">
          <button
            className="icon-button"
            aria-label={`${preference === 'saved' ? 'Unsave' : 'Save'} ${title(fragrance.name)}`}
            aria-pressed={preference === 'saved'}
            onClick={() => onSave(fragrance, 'saved')}
          >
            <Bookmark
              size={18}
              fill={preference === 'saved' ? 'currentColor' : 'none'}
            />
          </button>
          <button
            className="icon-button"
            aria-label={`Like ${title(fragrance.name)}`}
            aria-pressed={preference === 'liked'}
            onClick={() => onSave(fragrance, 'liked')}
          >
            <ThumbsUp size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`Dislike ${title(fragrance.name)}`}
            aria-pressed={preference === 'disliked'}
            onClick={() => onSave(fragrance, 'disliked')}
          >
            <ThumbsDown size={16} />
          </button>
        </div>
      </div>
      <details className="scent-details">
        <summary>Inside this scent</summary>
        <p className="match-reason">
          Shared notes:{' '}
          {fragrance.matched_notes.join(', ') || 'your scent profile'}
        </p>
        <dl>
          {(['top', 'middle', 'base'] as const).map((layer) => (
            <div key={layer}>
              <dt>{layer === 'middle' ? 'Heart' : title(layer)}</dt>
              <dd>{fragrance.notes[layer].join(', ') || 'Not listed'}</dd>
            </div>
          ))}
        </dl>
        <p className="similarity">
          Scent similarity: {fragrance.similarity.toFixed(2)} / 1
        </p>
        <p>A comparison of scent profiles, not a probability you’ll like it.</p>
        <a href={fragrance.url} target="_blank" rel="noreferrer">
          View catalogue source
        </a>
      </details>
    </article>
  )
}
