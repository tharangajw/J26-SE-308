import { MaturityTier } from './types';

export class MaturityTierMapper {
  /**
   * Maps composite P-Score (0-100) to maturity level bands.
   * - 0.0 - 39.9: Initial
   * - 40.0 - 64.9: Developing
   * - 65.0 - 84.9: Mature
   * - 85.0 - 100.0: Optimized
   */
  public static mapScoreToTier(pScore: number): MaturityTier {
    if (pScore >= 85.0) return 'Optimized';
    if (pScore >= 65.0) return 'Mature';
    if (pScore >= 40.0) return 'Developing';
    return 'Initial';
  }
}
