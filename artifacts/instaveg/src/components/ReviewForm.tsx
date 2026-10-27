import { useState } from "react";
import {
  useCreateReview, useGetReviewEligibility,
  getGetReviewEligibilityQueryKey, getGetProductReviewsQueryKey, getGetProductQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/useAuthStore";
import { Loader2, Star } from "lucide-react";

// M11: shown only to signed-in buyers the API says may review this product
// (a delivered order containing it and no review yet).
export function ReviewForm({ productId }: { productId: number }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const isBuyer = user?.role === "buyer";
  const { data: eligibility } = useGetReviewEligibility(productId, {
    query: { queryKey: getGetReviewEligibilityQueryKey(productId), enabled: isBuyer && productId > 0, retry: false },
  });
  const createReview = useCreateReview();

  if (!isBuyer || !eligibility?.canReview) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast({ title: "Choose a rating from 1 to 5 stars", variant: "destructive" });
      return;
    }
    createReview.mutate(
      { id: productId, data: { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) } },
      {
        onSuccess: () => {
          toast({ title: "Thanks for your review!" });
          setRating(0);
          setComment("");
          qc.invalidateQueries({ queryKey: getGetProductReviewsQueryKey(productId) });
          qc.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
          qc.invalidateQueries({ queryKey: getGetReviewEligibilityQueryKey(productId) });
        },
        onError: (err) => {
          const apiMessage = (err as { data?: { error?: unknown } }).data?.error;
          toast({
            title: "Could not submit your review",
            description: typeof apiMessage === "string" ? apiMessage : err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        },
      },
    );
  };

  const shown = hover || rating;
  return (
    <form onSubmit={submit} className="mb-8 bg-white/60 rounded-2xl border border-border/30 p-4 space-y-3">
      <h3 className="font-semibold">Rate this product</h3>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value > 1 ? "s" : ""}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHover(value)}
            className="p-0.5"
          >
            <Star className={`w-6 h-6 ${value <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        placeholder="Share what you liked (optional)"
        aria-label="Review comment (optional)"
        className="w-full rounded-lg border border-input bg-white/70 px-3 py-2 text-sm min-h-[72px] outline-none focus:ring-2 focus:ring-ring/20"
      />
      <Button type="submit" className="rounded-xl" disabled={createReview.isPending}>
        {createReview.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit review"}
      </Button>
    </form>
  );
}
