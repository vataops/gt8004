from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class Skill(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str] = []


class Capabilities(BaseModel):
    streaming: bool = False
    pushNotifications: bool = False
    stateTransitionHistory: bool = False


class AgentProvider(BaseModel):
    organization: str
    url: str


class Authentication(BaseModel):
    schemes: list[str] = []
    description: str = ""


class AgentCard(BaseModel):
    name: str
    description: str
    url: str
    version: str = "1.0.0"
    defaultInputModes: list[str] = ["text"]
    defaultOutputModes: list[str] = ["text"]
    capabilities: Capabilities = Capabilities()
    provider: Optional[AgentProvider] = None
    authentication: Optional[Authentication] = None
    skills: list[Skill] = []


class Part(BaseModel):
    type: str = "text"
    text: str


class Message(BaseModel):
    role: str = "user"
    parts: list[Part] = []


class TaskRequest(BaseModel):
    id: str = Field(default_factory=lambda: f"task-{uuid.uuid4().hex[:12]}")
    skill_id: Optional[str] = None
    message: Message


class TaskStatus(BaseModel):
    state: str = "submitted"


class Artifact(BaseModel):
    type: str = "application/json"
    parts: list[Part] = []


class TaskResponse(BaseModel):
    id: str
    status: TaskStatus
    artifacts: list[Artifact] = []
