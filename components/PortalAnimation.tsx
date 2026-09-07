"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

export default function PortalAnimation({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-void flex items-center justify-center overflow-hidden">
      <motion.div
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 8, opacity: 0 }}
        transition={{ duration: 2.2, ease: "easeIn" }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-rift-purple via-rift-pink to-rift-cyan"
      />
    </div>
  );
}
