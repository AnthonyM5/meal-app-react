import { FoodDetailsView } from './food-details-view'

export default function FoodDetailsPage({
  params,
}: {
  params: { foodId: string }
}) {
  return <FoodDetailsView foodId={params.foodId} />
}
