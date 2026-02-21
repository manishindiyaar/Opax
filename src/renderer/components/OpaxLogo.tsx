import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './OpaxLogo.css';
import opaxLogoImage from '../assets/opax_logo.png';

interface OpaxLogoProps {
  isLoading?: boolean;
  size?: number;
}

/**
 * OpaxLogo Component - Animated logo with rotation during loading state
 * 
 * - Rotates 360 degrees over 3 seconds with linear easing when loading
 * - Smooth 0.5s transition back to static when not loading
 * - Respects prefers-reduced-motion user preference
 */
export const OpaxLogo: React.FC<OpaxLogoProps> = ({
  isLoading = false,
  size = 28,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="opax-logo"
      style={{ width: size, height: size }}
      animate={{
        rotate: isLoading && !shouldReduceMotion ? 360 : 0,
      }}
      transition={
        isLoading && !shouldReduceMotion
          ? {
              duration: 3,
              ease: 'linear',
              repeat: Infinity,
            }
          : {
              duration: 0.5,
              ease: 'easeOut',
            }
      }
      aria-label={isLoading ? 'Loading...' : 'Opax logo'}
      role="img"
    >
      <img
        src={opaxLogoImage}
        alt="Opax"
        className="opax-logo__image"
        width={size}
        height={size}
      />
    </motion.div>
  );
};

export default OpaxLogo;
