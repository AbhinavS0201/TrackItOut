// backend/src/services/nutritionCalculator.js
/**
 * Deterministic Nutrition & Macro Calculation Engine
 * Strict rule: No LLM approximation, no fabricated zeroes.
 * Preserves NULL for missing/unreported nutrients.
 */

function calculateItemNutrients(product, loggedQuantity, loggedUnit) {
  const quantity = parseFloat(loggedQuantity);
  if (isNaN(quantity) || quantity <= 0) {
    throw new Error('Invalid logged quantity');
  }

  let scaleFactor = 0;
  let normalizedQuantity = quantity;
  let normalizedUnit = 'g';

  const basis = product.nutrition_basis; // 'per_100g' | 'per_100ml' | 'per_serving'
  const density = product.density_g_per_ml ? parseFloat(product.density_g_per_ml) : null;
  const servingWeightG = product.serving_weight_g ? parseFloat(product.serving_weight_g) : null;
  const servingVolumeMl = product.serving_volume_ml ? parseFloat(product.serving_volume_ml) : null;
  const servingQty = product.serving_quantity ? parseFloat(product.serving_quantity) : 1;

  const unit = (loggedUnit || '').trim().toLowerCase();

  if (basis === 'per_100g') {
    if (unit === 'g' || unit === 'gram' || unit === 'grams') {
      scaleFactor = quantity / 100.0;
      normalizedQuantity = quantity;
      normalizedUnit = 'g';
    } else if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters') {
      if (!density || density <= 0) {
        throw new Error('Volume-to-mass conversion requires a defined density (density_g_per_ml is missing)');
      }
      const massG = quantity * density;
      scaleFactor = massG / 100.0;
      normalizedQuantity = massG;
      normalizedUnit = 'g';
    } else if (unit === 'serving' || unit === (product.serving_unit || '').toLowerCase()) {
      if (!servingWeightG) {
        throw new Error('Serving-to-mass conversion requires serving_weight_g');
      }
      const totalGrams = (quantity / servingQty) * servingWeightG;
      scaleFactor = totalGrams / 100.0;
      normalizedQuantity = totalGrams;
      normalizedUnit = 'g';
    } else {
      throw new Error(`Unsupported unit '${loggedUnit}' for per_100g basis`);
    }
  } else if (basis === 'per_100ml') {
    if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters') {
      // Direct volumetric conversion - density NOT required!
      scaleFactor = quantity / 100.0;
      normalizedQuantity = quantity;
      normalizedUnit = 'ml';
    } else if (unit === 'g' || unit === 'gram' || unit === 'grams') {
      // Mass-to-volume conversion - density IS required!
      if (!density || density <= 0) {
        throw new Error('Mass-to-volume conversion requires a defined density (density_g_per_ml is missing)');
      }
      const volumeMl = quantity / density;
      scaleFactor = volumeMl / 100.0;
      normalizedQuantity = volumeMl;
      normalizedUnit = 'ml';
    } else if (unit === 'serving' || unit === 'pack' || unit === (product.serving_unit || '').toLowerCase()) {
      if (!servingVolumeMl) {
        throw new Error('Serving-to-volume conversion requires serving_volume_ml');
      }
      const totalMl = (quantity / servingQty) * servingVolumeMl;
      scaleFactor = totalMl / 100.0;
      normalizedQuantity = totalMl;
      normalizedUnit = 'ml';
    } else {
      throw new Error(`Unsupported unit '${loggedUnit}' for per_100ml basis`);
    }
  } else if (basis === 'per_serving') {
    if (unit === 'serving' || unit === (product.serving_unit || '').toLowerCase() || unit === 'scoop') {
      scaleFactor = quantity / servingQty;
      normalizedQuantity = quantity;
      normalizedUnit = 'serving';
    } else if (unit === 'g' || unit === 'gram' || unit === 'grams') {
      if (!servingWeightG) {
        throw new Error('Mass-to-serving conversion requires serving_weight_g');
      }
      scaleFactor = quantity / servingWeightG;
      normalizedQuantity = quantity;
      normalizedUnit = 'g';
    } else if (unit === 'ml' || unit === 'milliliter') {
      if (!servingVolumeMl) {
        throw new Error('Volume-to-serving conversion requires serving_volume_ml');
      }
      scaleFactor = quantity / servingVolumeMl;
      normalizedQuantity = quantity;
      normalizedUnit = 'ml';
    } else {
      throw new Error(`Unsupported unit '${loggedUnit}' for per_serving basis`);
    }
  } else {
    throw new Error(`Unknown nutrition basis: ${basis}`);
  }

  // Scale nutrients: preserve NULL if product nutrient is NULL
  const scaleNutrient = (val) => {
    if (val === null || val === undefined) return null;
    return parseFloat((parseFloat(val) * scaleFactor).toFixed(2));
  };

  return {
    scaleFactor,
    normalizedQuantity: parseFloat(normalizedQuantity.toFixed(2)),
    normalizedUnit,
    calories: scaleNutrient(product.calories),
    protein: scaleNutrient(product.protein),
    carbohydrates: scaleNutrient(product.carbohydrates),
    fats: scaleNutrient(product.fats),
    fiber: scaleNutrient(product.fiber),
    sugar: scaleNutrient(product.sugar),
    sodium_mg: scaleNutrient(product.sodium_mg)
  };
}

/**
 * Aggregates a list of meal food items into daily totals.
 * If all items have NULL for a nutrient, the sum is NULL.
 * If some items are NULL, calculates the sum of non-null values,
 * and reports is_complete = false with missing_items_count.
 */
function aggregateNutrients(items) {
  const nutrients = ['calories', 'protein', 'carbohydrates', 'fats', 'fiber', 'sugar', 'sodium_mg'];
  const summary = {};

  for (const nutrient of nutrients) {
    let sum = 0;
    let nonNullCount = 0;
    let nullCount = 0;

    for (const item of items) {
      const val = item[nutrient];
      if (val === null || val === undefined) {
        nullCount++;
      } else {
        sum += parseFloat(val);
        nonNullCount++;
      }
    }

    if (nonNullCount === 0) {
      summary[nutrient] = null;
    } else {
      summary[nutrient] = parseFloat(sum.toFixed(2));
    }
    summary[`${nutrient}_is_complete`] = nullCount === 0;
    summary[`${nutrient}_missing_count`] = nullCount;
  }

  return summary;
}

module.exports = {
  calculateItemNutrients,
  aggregateNutrients
};
