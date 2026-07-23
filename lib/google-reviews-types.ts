export type GoogleReview = {
  authorName: string
  authorUri: string
  rating: number
  text: string
  relativeTime: string
}

export type GoogleReviewSummary = {
  placeId: string
  businessName: string
  rating: number
  reviewCount: number
  googleMapsUri: string
  reviews: GoogleReview[]
}
