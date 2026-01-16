-- ============================================================================
-- Trading Analytics Database Schema
-- ============================================================================
-- Stores trade history for psychological analysis and performance tracking
-- Implements RLS (Row Level Security) for multi-tenant isolation

-- Create trades table
create table if not exists public.trades (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    
    -- Trade details
    symbol varchar(10) not null,
    timeframe varchar(5) not null, -- 1m, 5m, 15m, etc.
    type varchar(4) not null check (type in ('BUY', 'SELL')),
    shares integer not null check (shares > 0),
    
    -- Pricing
    entry_price decimal(10, 2) not null,
    exit_price decimal(10, 2),
    realized_pnl decimal(10, 2),
    
    -- Timing
    entry_time timestamptz not null default now(),
    exit_time timestamptz,
    duration_seconds integer, -- Calculated: exit_time - entry_time
    
    -- Metadata
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

create index if not exists idx_trades_user_id on public.trades(user_id);
create index if not exists idx_trades_created_at on public.trades(created_at desc);
create index if not exists idx_trades_symbol on public.trades(symbol);
create index if not exists idx_trades_timeframe on public.trades(timeframe);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

alter table public.trades enable row level security;

-- Users can only see their own trades
create policy "Users can view own trades"
    on public.trades
    for select
    using (auth.uid() = user_id);

-- Users can insert their own trades
create policy "Users can insert own trades"
    on public.trades
    for insert
    with check (auth.uid() = user_id);

-- Users can update their own trades (e.g., close position)
create policy "Users can update own trades"
    on public.trades
    for update
    using (auth.uid() = user_id);

-- Users can delete their own trades
create policy "Users can delete own trades"
    on public.trades
    for delete
    using (auth.uid() = user_id);

-- ============================================================================
-- Triggers for Auto-Calculation
-- ============================================================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_updated_at
    before update on public.trades
    for each row
    execute function public.handle_updated_at();

-- Auto-calculate duration when exit_time is set
create or replace function public.calculate_trade_duration()
returns trigger as $$
begin
    if new.exit_time is not null and new.entry_time is not null then
        new.duration_seconds = extract(epoch from (new.exit_time - new.entry_time))::integer;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger set_trade_duration
    before insert or update on public.trades
    for each row
    execute function public.calculate_trade_duration();

-- Auto-calculate realized P&L when trade is closed
create or replace function public.calculate_realized_pnl()
returns trigger as $$
begin
    if new.exit_price is not null and new.entry_price is not null then
        -- Calculate P&L based on trade type
        if new.type = 'BUY' then
            -- Long position: profit = (exit - entry) * shares
            new.realized_pnl = (new.exit_price - new.entry_price) * new.shares;
        else
            -- Short position: profit = (entry - exit) * shares
            new.realized_pnl = (new.entry_price - new.exit_price) * new.shares;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger set_realized_pnl
    before insert or update on public.trades
    for each row
    execute function public.calculate_realized_pnl();

-- ============================================================================
-- Helper Views for Analytics
-- ============================================================================

-- View: User trading statistics
create or replace view public.user_trade_stats as
select
    user_id,
    count(*) as total_trades,
    count(*) filter (where realized_pnl > 0) as winning_trades,
    count(*) filter (where realized_pnl < 0) as losing_trades,
    count(*) filter (where realized_pnl is null) as open_trades,
    
    -- Win rate
    case 
        when count(*) filter (where realized_pnl is not null) > 0 then
            (count(*) filter (where realized_pnl > 0)::decimal / 
             count(*) filter (where realized_pnl is not null)) * 100
        else 0
    end as win_rate_percent,
    
    -- P&L stats
    coalesce(sum(realized_pnl), 0) as total_pnl,
    coalesce(avg(realized_pnl) filter (where realized_pnl > 0), 0) as avg_win,
    coalesce(avg(realized_pnl) filter (where realized_pnl < 0), 0) as avg_loss,
    coalesce(max(realized_pnl), 0) as largest_win,
    coalesce(min(realized_pnl), 0) as largest_loss,
    
    -- Profit factor
    case
        when abs(sum(realized_pnl) filter (where realized_pnl < 0)) > 0 then
            sum(realized_pnl) filter (where realized_pnl > 0) / 
            abs(sum(realized_pnl) filter (where realized_pnl < 0))
        else 0
    end as profit_factor
from public.trades
where realized_pnl is not null
group by user_id;

-- Grant access to view
grant select on public.user_trade_stats to authenticated;

-- ============================================================================
-- Sample Data (Development Only - Remove in Production)
-- ============================================================================

-- Uncomment to insert sample trades for testing
-- insert into public.trades (user_id, symbol, timeframe, type, shares, entry_price, exit_price, entry_time, exit_time) values
--     (auth.uid(), 'BBRI', '5m', 'BUY', 100, 5000, 5050, now() - interval '1 hour', now() - interval '30 minutes'),
--     (auth.uid(), 'BBCA', '15m', 'BUY', 50, 10000, 9950, now() - interval '2 hours', now() - interval '1 hour'),
--     (auth.uid(), 'ADRO', '1m', 'SELL', 200, 2500, 2480, now() - interval '3 hours', now() - interval '2.5 hours');
