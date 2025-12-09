import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getVariant,
  clearExperiment,
  getCurrentVariant,
  EXPERIMENTS,
  type ExperimentConfig,
} from './experiment'

// Mock the api module
vi.mock('./api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
  },
}))

describe('experiment utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('getVariant', () => {
    const testExperiment: ExperimentConfig = {
      name: 'test_experiment',
      variants: ['control', 'variant'],
      weights: [50, 50],
    }

    it('should assign a variant and persist it', () => {
      const variant = getVariant(testExperiment)

      expect(['control', 'variant']).toContain(variant)
      expect(localStorage.getItem('exp_test_experiment')).toBe(variant)
    })

    it('should return the same variant on subsequent calls', () => {
      const first = getVariant(testExperiment)
      const second = getVariant(testExperiment)
      const third = getVariant(testExperiment)

      expect(first).toBe(second)
      expect(second).toBe(third)
    })

    it('should respect stored variant', () => {
      localStorage.setItem('exp_test_experiment', 'variant')

      const result = getVariant(testExperiment)

      expect(result).toBe('variant')
    })

    it('should reassign if stored variant is invalid', () => {
      localStorage.setItem('exp_test_experiment', 'invalid_variant')

      const result = getVariant(testExperiment)

      expect(['control', 'variant']).toContain(result)
    })
  })

  describe('clearExperiment', () => {
    it('should remove experiment assignment from storage', () => {
      localStorage.setItem('exp_my_experiment', 'control')

      clearExperiment('my_experiment')

      expect(localStorage.getItem('exp_my_experiment')).toBeNull()
    })

    it('should allow new assignment after clearing', () => {
      const testExperiment: ExperimentConfig = {
        name: 'clear_test',
        variants: ['control', 'variant'],
      }

      const first = getVariant(testExperiment)
      clearExperiment('clear_test')

      // Could be same or different due to randomness
      const second = getVariant(testExperiment)
      expect(['control', 'variant']).toContain(second)
    })
  })

  describe('getCurrentVariant', () => {
    it('should return null if no variant assigned', () => {
      const result = getCurrentVariant('unassigned_experiment')

      expect(result).toBeNull()
    })

    it('should return stored variant without triggering assignment', () => {
      localStorage.setItem('exp_existing', 'variant')

      const result = getCurrentVariant('existing')

      expect(result).toBe('variant')
    })
  })

  describe('EXPERIMENTS.HOMEPAGE_CTA', () => {
    it('should have correct configuration', () => {
      expect(EXPERIMENTS.HOMEPAGE_CTA.name).toBe('homepage_cta_v1')
      expect(EXPERIMENTS.HOMEPAGE_CTA.variants).toEqual(['control', 'variant'])
      expect(EXPERIMENTS.HOMEPAGE_CTA.weights).toEqual([50, 50])
    })
  })

  describe('weight distribution', () => {
    it('should distribute variants according to weights (statistical test)', () => {
      const heavyControlExperiment: ExperimentConfig = {
        name: 'weighted_test',
        variants: ['control', 'variant'],
        weights: [90, 10],
      }

      // Run 100 assignments and check distribution is roughly correct
      const counts = { control: 0, variant: 0 }

      for (let i = 0; i < 100; i++) {
        clearExperiment('weighted_test')
        const result = getVariant(heavyControlExperiment)
        counts[result]++
      }

      // With 90/10 split, control should be significantly more common
      // Allow for some variance
      expect(counts.control).toBeGreaterThan(counts.variant)
    })
  })
})
