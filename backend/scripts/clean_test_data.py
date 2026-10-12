import asyncio
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import create_db_client, result_to_dicts

async def main():
    client = create_db_client()
    try:
        # Check products with test SKU patterns
        rs = await client.execute("SELECT id, sku, name FROM products WHERE sku LIKE '%-%'")
        test_prods = result_to_dicts(rs)
        print(f"Found {len(test_prods)} test products to clean up.")
        for p in test_prods:
            pid = p["id"]
            # Find and delete sale items
            await client.execute("DELETE FROM sale_items WHERE product_id = ?", [pid])
            # Find and delete inventory movements
            await client.execute("DELETE FROM inventory_movements WHERE product_id = ?", [pid])
            # Delete product
            await client.execute("DELETE FROM products WHERE id = ?", [pid])
            print(f"Deleted product {p['sku']} ({p['name']})")
        
        # Clean any sales without items
        await client.execute("DELETE FROM sales WHERE id NOT IN (SELECT DISTINCT sale_id FROM sale_items)")
        print("Cleanup completed successfully.")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
