export type CourseCheckoutDTO = {
  courseId: string;
  couponCode?: string;
};

export type CourseCheckoutPayload = {
  courseId: string;
  userId: string;
  couponCode?: string;
  firstName: string;
  email: string;
};

export type CoursePricingDoc = {
  coursePricing: number;
};
