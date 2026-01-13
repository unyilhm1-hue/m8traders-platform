/**
 * Challenge Engine
 * Core validation and scoring logic for challenges
 * Phase 5A: Challenge Infrastructure
 */

import type {
    Challenge,
    ChallengeConfig,
    ChallengeResult,
    PatternChallengeConfig,
    IndicatorChallengeConfig,
    PsychologyChallengeConfig,
    RiskChallengeConfig,
} from '@/types';

export class ChallengeEngine {
    private challenge: Challenge;
    private startTime: number;

    constructor(challenge: Challenge) {
        this.challenge = challenge;
        this.startTime = Date.now();
    }

    /**
     * Validate user's answer and generate result
     */
    validateAnswer(answer: any): ChallengeResult {
        const timeTaken = Math.floor((Date.now() - this.startTime) / 1000); // seconds

        let isCorrect = false;
        let feedback = '';
        let explanation = '';

        // Validate based on challenge type
        switch (this.challenge.config.type) {
            case 'pattern':
                ({ isCorrect, feedback } = this.validatePattern(answer));
                break;

            case 'indicator':
                ({ isCorrect, feedback } = this.validateMultipleChoice(
                    answer,
                    this.challenge.config as IndicatorChallengeConfig
                ));
                break;

            case 'psychology':
                ({ isCorrect, feedback } = this.validateMultipleChoice(
                    answer,
                    this.challenge.config as PsychologyChallengeConfig
                ));
                break;

            case 'risk':
                ({ isCorrect, feedback } = this.validateMultipleChoice(
                    answer,
                    this.challenge.config as RiskChallengeConfig
                ));
                break;

            case 'entry_exit':
                ({ isCorrect, feedback } = this.validateMultipleChoice(answer, this.challenge.config as any));
                break;

            case 'case_study':
                ({ isCorrect, feedback } = this.validateCaseStudy(answer));
                break;

            default:
                feedback = 'Invalid challenge type';
        }

        // Get explanation
        explanation = this.challenge.config.explanation || '';

        // Calculate score
        const score = this.calculateScore(isCorrect, timeTaken);

        return {
            success: isCorrect,
            score,
            feedback,
            explanation,
            time_taken: timeTaken,
        };
    }

    /**
     * Validate pattern recognition challenge
     */
    private validatePattern(answer: any): { isCorrect: boolean; feedback: string } {
        const config = this.challenge.config as PatternChallengeConfig;

        // For pattern challenges, answer should be the candle index where pattern was spotted
        const { candleIndex } = answer;

        if (typeof candleIndex !== 'number') {
            return {
                isCorrect: false,
                feedback: 'Invalid answer format. Please select a candle.',
            };
        }

        // TODO: Implement actual pattern detection logic
        // For now, accept any reasonable answer within tolerance
        const isCorrect = true; // Simplified for infrastructure phase

        const feedback = isCorrect
            ? `Correct! You identified the ${config.pattern} pattern.`
            : `Not quite. The ${config.pattern} pattern has specific characteristics. Try again!`;

        return { isCorrect, feedback };
    }

    /**
     * Validate multiple choice challenges (indicator, psychology, risk, entry_exit)
     */
    private validateMultipleChoice(
        answer: any,
        config: IndicatorChallengeConfig | PsychologyChallengeConfig | RiskChallengeConfig
    ): { isCorrect: boolean; feedback: string } {
        const { selectedOption } = answer;

        if (!selectedOption) {
            return {
                isCorrect: false,
                feedback: 'Please select an answer.',
            };
        }

        const isCorrect = selectedOption === config.correct_answer;

        // Find the selected option to get specific feedback
        const option = config.options.find((opt) => opt.id === selectedOption);
        const feedback = option?.feedback || (isCorrect ? 'Correct!' : 'Incorrect. Try again!');

        return { isCorrect, feedback };
    }

    /**
     * Validate case study challenges (multi-question)
     */
    private validateCaseStudy(answer: any): { isCorrect: boolean; feedback: string } {
        const config = this.challenge.config as any; // CaseStudyChallengeConfig
        const { answers } = answer;

        if (!answers || !Array.isArray(answers)) {
            return {
                isCorrect: false,
                feedback: 'Invalid answer format.',
            };
        }

        // Validate each question
        let correctCount = 0;
        const totalQuestions = config.questions?.length || 0;

        answers.forEach((userAnswer: any, index: number) => {
            const question = config.questions[index];
            if (question && userAnswer === question.correct_answer) {
                correctCount++;
            }
        });

        const isCorrect = correctCount === totalQuestions;
        const percentage = Math.round((correctCount / totalQuestions) * 100);

        const feedback = `You answered ${correctCount} out of ${totalQuestions} questions correctly (${percentage}%).`;

        return { isCorrect, feedback };
    }

    /**
     * Calculate score based on correctness and time
     */
    private calculateScore(isCorrect: boolean, timeTaken: number): number {
        if (!isCorrect) return 0;

        let score = this.challenge.points;

        // Time bonus (if time limit exists and user finished quickly)
        if (this.challenge.time_limit) {
            const timeRatio = timeTaken / this.challenge.time_limit;

            if (timeRatio <= 0.5) {
                // Finished in less than half the time - 20% bonus
                score = Math.floor(score * 1.2);
            } else if (timeRatio <= 0.75) {
                // Finished in less than 3/4 the time - 10% bonus
                score = Math.floor(score * 1.1);
            }
        }

        return score;
    }

    /**
     * Calculate score with multipliers (for store to use)
     */
    static calculateFinalScore(
        baseScore: number,
        isFirstAttempt: boolean,
        currentStreak: number
    ): number {
        let finalScore = baseScore;

        // First attempt bonus
        if (isFirstAttempt) {
            finalScore = Math.floor(finalScore * 1.5);
        }

        // Streak bonus (max 2x at 10 streak)
        const streakMultiplier = 1 + Math.min(currentStreak * 0.1, 1.0);
        finalScore = Math.floor(finalScore * streakMultiplier);

        return finalScore;
    }

    /**
     * Get time taken so far
     */
    getTimeTaken(): number {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    /**
     * Check if time limit exceeded
     */
    isTimeExpired(): boolean {
        if (!this.challenge.time_limit) return false;
        return this.getTimeTaken() > this.challenge.time_limit;
    }

    /**
     * Reset timer
     */
    resetTimer(): void {
        this.startTime = Date.now();
    }
}
