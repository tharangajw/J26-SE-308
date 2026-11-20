import { MaturityTier } from './types';

// Utility mapper that translates composite numerical P-Scores into standardized
// software engineering maturity classifications for executive dashboards.
export class MaturityTierMapper {
  // Maps a 0-100 P-Score into one of four tiers: Initial (<40),
  // Developing (40-64.9), Mature (65-84.9), or Optimized (>=85).
  public static mapScoreToTier(pScore: number): MaturityTier {
    if (pScore >= 85.0) return 'Optimized';
    if (pScore >= 65.0) return 'Mature';
    if (pScore >= 40.0) return 'Developing';
    return 'Initial';
  }
}
