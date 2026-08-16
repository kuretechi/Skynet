"use client";

import { useState } from "react";
import Link from "next/link";
import { LikeButton, SpoilerText } from "@/components/community-buttons";
import { ReviewForm } from "@/components/review-form";
import type { ReviewCard } from "@/lib/actions";

export function ReviewSection({
  providerId,
  userId,
  initialReviews,
}: {
  providerId: string;
  userId: string;
  initialReviews: ReviewCard[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const myReview = reviews.find((review) => review.userId === userId);

  // The posted review is placed straight into the list, so the section is
  // correct even when the router refresh behind it is slow.
  const onPosted = (review: ReviewCard) =>
    setReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
        <h2 className="label">Reviews</h2>
        <span className="text-[10px] text-[var(--muted)]">{reviews.length}</span>
      </div>
      <ReviewForm
        providerId={providerId}
        initialText={myReview?.text}
        initialSpoiler={myReview?.spoiler}
        onPosted={onPosted}
      />
      <ul className="flex flex-col gap-6">
        {reviews.map((review) => (
          <li key={review.id} className="flex flex-col gap-2 border-t border-[var(--line)] pt-4">
            <Link href={`/u/${review.userId}`} className="label">
              {review.userName}
            </Link>
            {review.spoiler ? (
              <SpoilerText text={review.text} />
            ) : (
              <p className="text-sm leading-relaxed">{review.text}</p>
            )}
            <LikeButton reviewId={review.id} initialLiked={review.liked} initialCount={review.likeCount} />
          </li>
        ))}
      </ul>
    </section>
  );
}
