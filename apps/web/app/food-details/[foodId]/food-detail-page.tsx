import { FoodDetailsView } from './food-details-view'

export default async function FoodDetailsPage({
  params,
}: {
  params: Promise<{ foodId: string }>
}) {
  const { foodId } = await params
  return <FoodDetailsView foodId={foodId} />
}
