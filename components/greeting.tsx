import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8"
      key="overview"
    >
      {/* Brutalist decorative element */}
      <motion.div
        animate={{ scaleX: 1 }}
        className="mb-6 h-2 w-24 origin-left bg-primary"
        initial={{ scaleX: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
      />

      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="font-mono text-4xl font-bold uppercase tracking-tight md:text-6xl"
        exit={{ opacity: 0, x: -20 }}
        initial={{ opacity: 0, x: -20 }}
        style={{ fontFamily: "'Bebas Neue', Impact, sans-serif" }}
        transition={{ delay: 0.4 }}
      >
        <span className="text-foreground">CM</span>
        <span className="text-primary">ED</span>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 border-l-4 border-primary pl-4 font-mono text-sm uppercase tracking-wide text-muted-foreground"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        Type your message below to begin
      </motion.div>
    </div>
  );
};
