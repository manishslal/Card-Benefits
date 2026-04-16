from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import re


class LoungeAirport(BaseModel):
    id: Optional[str] = None
    iata_code: str = Field(..., min_length=3, max_length=3)
    name: str
    city: str
    timezone: str
    created_at: Optional[datetime] = None

    @field_validator('iata_code')
    @classmethod
    def iata_must_be_uppercase(cls, v: str) -> str:
        if not re.match(r'^[A-Z]{3}$', v):
            raise ValueError('iata_code must be exactly 3 uppercase letters')
        return v


class LoungeTerminal(BaseModel):
    id: Optional[str] = None
    airport_id: str
    name: str
    is_airside: bool = True
    created_at: Optional[datetime] = None


class Lounge(BaseModel):
    id: Optional[str] = None
    terminal_id: str
    name: str
    operator: Optional[str] = None
    location_details: Optional[str] = None
    operating_hours: Optional[dict] = None  # {"mon": ["06:00-22:00"]}
    amenities: Optional[dict] = None  # {"has_showers": true, ...}
    is_restaurant_credit: bool = False
    may_deny_entry: bool = False
    last_verified_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class LoungeAccessMethod(BaseModel):
    id: Optional[str] = None
    name: str
    category: str  # "Credit Card" | "Lounge Network" | "Ticket Class" | "Airline Status"
    provider: Optional[str] = None
    grants_network_id: Optional[str] = None
    created_at: Optional[datetime] = None

    @field_validator('category')
    @classmethod
    def category_must_be_valid(cls, v: str) -> str:
        valid = {'Credit Card', 'Lounge Network', 'Ticket Class', 'Airline Status'}
        if v not in valid:
            raise ValueError(f'category must be one of {valid}')
        return v


class LoungeAccessRule(BaseModel):
    id: Optional[str] = None
    lounge_id: str
    access_method_id: str
    guest_limit: Optional[int] = None
    guest_fee: Optional[Decimal] = None
    guest_conditions: Optional[str] = None
    entry_cost: Optional[Decimal] = None
    time_limit_hours: Optional[int] = None
    conditions: Optional[dict] = None
    notes: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class CardLoungeAccess(BaseModel):
    id: Optional[str] = None
    card_id: str
    access_method_id: str
    created_at: Optional[datetime] = None


class LoungeScrapeRun(BaseModel):
    id: Optional[str] = None
    source_name: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_found: Optional[int] = None
    records_upserted: Optional[int] = None
    errors: Optional[list] = None
    status: str  # "running" | "completed" | "failed"


# Composite models for common read patterns


class AccessRuleWithMethod(BaseModel):
    """An access rule with its method name expanded."""
    rule_id: str
    access_method_name: str
    access_method_category: str
    guest_limit: Optional[int] = None
    guest_fee: Optional[Decimal] = None
    entry_cost: Optional[Decimal] = None
    time_limit_hours: Optional[int] = None
    conditions: Optional[dict] = None
    notes: Optional[str] = None


class LoungeWithRules(BaseModel):
    """Joins lounges + access_rules + access_methods for the common read pattern."""
    id: str
    terminal_id: str
    name: str
    operator: Optional[str] = None
    location_details: Optional[str] = None
    operating_hours: Optional[dict] = None
    amenities: Optional[dict] = None
    is_restaurant_credit: bool = False
    may_deny_entry: bool = False
    last_verified_at: Optional[datetime] = None
    # From terminal/airport join
    airport_iata: Optional[str] = None
    airport_name: Optional[str] = None
    terminal_name: Optional[str] = None
    # Access rules
    access_rules: List[AccessRuleWithMethod] = []
