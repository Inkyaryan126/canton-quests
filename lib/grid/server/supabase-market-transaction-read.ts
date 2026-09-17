import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridListMarketTransactionFeedInput,
  GridMarketTransactionFeedEntry,
  GridMarketTransactionFeedPropertyTransfer,
  GridMarketTransactionReadPort,
} from './market-transaction-read-port';

interface CreditTransfer {
  fromPlayerId: string;
  toPlayerId: string;
  amountCredits: number;
}

interface AssetTransfer {
  assetId: string;
  kind: 'property' | 'asset';
  fromPlayerId: string;
  toPlayerId: string;
  estimatedValueCredits: number;
}

interface TaxCharge {
  playerId: string;
  amountCredits: number;
}

interface TransactionRow {
  transaction_id: string;
  city_id: string;
  source: 'direct-deal' | 'fixed-price';
  occurred_at: string;
  credit_transfers: CreditTransfer[];
  asset_transfers: AssetTransfer[];
  tax_charges: TaxCharge[];
}

interface PropertyRow {
  id: string;
  slug: string;
  display_name: string;
  public_name_safe: boolean;
}

export function createSupabaseGridMarketTransactionReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridMarketTransactionReadPort {
  if (!client) {
    throw new Error('Grid market transaction feed requires Supabase configuration');
  }

  return {
    async listRecentTransactions(
      input: GridListMarketTransactionFeedInput,
    ): Promise<GridMarketTransactionFeedEntry[]> {
      const { data, error } = await client
        .from('grid_market_transactions')
        .select(
          'transaction_id,city_id,source,occurred_at,credit_transfers,asset_transfers,tax_charges,participant_a_id,participant_b_id',
        )
        .eq('season_id', input.seasonId)
        .or(
          `participant_a_id.eq.${input.viewerPlayerId},participant_b_id.eq.${input.viewerPlayerId}`,
        )
        .order('occurred_at', { ascending: false })
        .limit(input.limit);

      if (error) {
        throw new Error(
          `Failed to list Grid market transactions: ${error.message}`,
        );
      }

      const rows = (data ?? []) as TransactionRow[];
      if (rows.length === 0) return [];

      const propertyIds = [
        ...new Set(
          rows.flatMap((row) =>
            row.asset_transfers
              .filter((transfer) => transfer.kind === 'property')
              .map((transfer) => transfer.assetId),
          ),
        ),
      ];

      let properties = new Map<string, PropertyRow>();
      if (propertyIds.length > 0) {
        const { data: propertyData, error: propertyError } = await client
          .from('grid_properties')
          .select('id,slug,display_name,public_name_safe')
          .in('id', propertyIds);
        if (propertyError) {
          throw new Error(
            `Failed to load Grid market transaction properties: ${propertyError.message}`,
          );
        }
        properties = new Map(
          ((propertyData ?? []) as PropertyRow[]).map((row) => [row.id, row]),
        );
      }

      return rows.map((row) => {
        const viewer = input.viewerPlayerId;
        const netCreditsDelta = row.credit_transfers.reduce((sum, transfer) => {
          if (transfer.toPlayerId === viewer) return sum + transfer.amountCredits;
          if (transfer.fromPlayerId === viewer) return sum - transfer.amountCredits;
          return sum;
        }, 0);
        const taxCreditsPaid = row.tax_charges
          .filter((charge) => charge.playerId === viewer)
          .reduce((sum, charge) => sum + charge.amountCredits, 0);

        const propertyTransfers: GridMarketTransactionFeedPropertyTransfer[] =
          row.asset_transfers
            .filter(
              (transfer) =>
                transfer.kind === 'property' &&
                (transfer.toPlayerId === viewer ||
                  transfer.fromPlayerId === viewer),
            )
            .map((transfer) => {
              const property = properties.get(transfer.assetId);
              return {
                propertySlug: property?.slug ?? transfer.assetId,
                propertyName:
                  property && property.public_name_safe
                    ? property.display_name
                    : 'Grid Property',
                direction:
                  transfer.toPlayerId === viewer
                    ? ('acquired' as const)
                    : ('sold' as const),
                estimatedValueCredits: transfer.estimatedValueCredits,
              };
            });

        return {
          transactionId: row.transaction_id,
          cityId: row.city_id,
          occurredAt: row.occurred_at,
          source: row.source,
          netCreditsDelta,
          taxCreditsPaid,
          propertyTransfers,
        };
      });
    },
  };
}
