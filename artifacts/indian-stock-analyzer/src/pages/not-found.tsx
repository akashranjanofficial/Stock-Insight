import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">404 - Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The page or stock symbol you are looking for does not exist in our database or the URL is incorrect.
          </p>
          <Link href="/" className="inline-flex items-center justify-center h-10 px-6 font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Return to Terminal
          </Link>
        </motion.div>
      </div>
    </Layout>
  );
}
