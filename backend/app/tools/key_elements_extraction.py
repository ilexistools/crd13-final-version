from pydantic import BaseModel, Field

from app.orchestration import gpt


class KeyElements(BaseModel):
    products: list[str] = Field(default_factory=list)
    animals: list[str] = Field(default_factory=list)
    establishments: list[str] = Field(default_factory=list)
    authorities: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    zones: list[str] = Field(default_factory=list)
    diseases: list[str] = Field(default_factory=list)
    activities: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)
    regulatory_assurances: list[str] = Field(default_factory=list)


class KeyElementsExtractionResponse(BaseModel):
    attestation: str
    key_elements: KeyElements
    missing_information: list[str] = Field(default_factory=list)


class KeyElementsExtractionTool:
    def __init__(self):
        self.__create_gpts()

    def __create_gpts(self):
        self.__gpt_key_elements_extractor = gpt.GPT(agent_id="key_elements_extractor")
        self.__gpt_key_elements_extractor.output_type = KeyElementsExtractionResponse

    def run(self, attestation: str) -> dict:
        prompt = f"Extract key elements from the following attestation: {attestation}"
        result = self.__gpt_key_elements_extractor.run_sync(prompt)
        return self._format_result(attestation, result)

    async def run_async(self, attestation: str) -> dict:
        prompt = f"Extract key elements from the following attestation: {attestation}"
        result = await self.__gpt_key_elements_extractor.run(prompt)
        return self._format_result(attestation, result)

    @staticmethod
    def _format_result(attestation: str, result: KeyElementsExtractionResponse) -> dict:
        return {
            "input": {"attestation": attestation},
            "results": result,
        }
