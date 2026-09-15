import { LEGAL_LAST_UPDATED } from "./legal-constants";
import { LegalPoliciesContent, LegalSection } from "./legal";

const userGeneratedContentSection: LegalSection = {
  subtitle: "Contenido generado por usuarios y moderación",
  paragraphs: [
    "RecCool permite a los usuarios crear, publicar e interactuar con contenido generado por usuarios, incluyendo comentarios públicos, Video Reactions, calificaciones, recomendaciones, reacciones y otras interacciones sociales disponibles en la plataforma.",
    "Cada usuario es responsable del contenido que publica y de sus interacciones dentro de RecCool. No se permite publicar contenido ilegal, ofensivo, amenazante, acosador, discriminatorio, sexualmente inapropiado, fraudulento, engañoso, difamatorio, que vulnere derechos de terceros, que exponga información privada de otras personas o que pueda afectar la seguridad de la comunidad.",
    "RecCool dispone de mecanismos para denunciar contenido y usuarios. Dependiendo del tipo de contenido o interacción, los usuarios podrán denunciar comentarios públicos, Video Reactions o cuentas de otros usuarios, seleccionar el motivo de la denuncia y proporcionar información adicional que facilite su revisión.",
    "No todos los tipos de actividad o interacción admiten una denuncia de contenido. Cuando una actividad no corresponda a contenido generado por usuarios susceptible de ser denunciado, el usuario podrá utilizar las opciones disponibles para denunciar o restringir al usuario cuando corresponda.",
    "Las denuncias podrán ser revisadas por administradores autorizados de RecCool. Durante este proceso, una denuncia podrá encontrarse pendiente, en revisión, resuelta o rechazada. La presentación de una denuncia no implica automáticamente que el contenido será eliminado ni que el usuario denunciado haya infringido estas políticas.",
    "Como resultado de una revisión, RecCool podrá mantener, limitar, ocultar o eliminar contenido, así como adoptar medidas sobre una cuenta cuando determine que existe una infracción de estas políticas, de la ley aplicable, de los derechos de terceros o de las normas de seguridad y convivencia de la plataforma.",
    "RecCool también permite restringir usuarios. Cuando un usuario restringe a otro, la restricción funciona de manera bilateral: mientras permanezca activa, ninguno de los dos podrá acceder al perfil ni visualizar el contenido del otro dentro de las áreas de la plataforma sujetas a esta restricción. La restricción podrá retirarse posteriormente desde la sección “Privacidad y Seguridad”.",
    "Denunciar a un usuario, denunciar contenido y restringir a un usuario son funciones diferentes. Una denuncia solicita que RecCool revise una posible infracción, mientras que una restricción controla la interacción y visibilidad entre dos usuarios.",
    "El uso abusivo, fraudulento o deliberadamente falso de las herramientas de denuncia podrá dar lugar a medidas sobre la cuenta que realice dicho uso.",
    "RecCool podrá adoptar medidas adicionales frente a infracciones graves o reiteradas, incluyendo limitaciones de funcionalidades, suspensión temporal o permanente de cuentas u otras acciones razonablemente necesarias para proteger a los usuarios y a la comunidad.",
    "Al publicar contenido en RecCool, el usuario declara que cuenta con los derechos necesarios para compartirlo y que dicho contenido no vulnera derechos de autor, privacidad, imagen, propiedad intelectual u otros derechos de terceros.",
  ],
};

const removeSectionNumber = (subtitle: string) => subtitle.replace(/^\s*\d+\.\s*/, "");

export function prepareSpanishLegalPolicies(content: LegalPoliciesContent): LegalPoliciesContent {
  const existingSections = content.sections.filter(
    (section) => removeSectionNumber(section.subtitle).toLocaleLowerCase("es") !== userGeneratedContentSection.subtitle.toLocaleLowerCase("es"),
  );
  const conductIndex = existingSections.findIndex(
    (section) => removeSectionNumber(section.subtitle).toLocaleLowerCase("es") === "conducta y contenido",
  );
  const insertionIndex = conductIndex >= 0 ? conductIndex + 1 : 4;
  const sections = [
    ...existingSections.slice(0, insertionIndex),
    userGeneratedContentSection,
    ...existingSections.slice(insertionIndex),
  ].map((section, index) => ({
    ...section,
    subtitle: `${index + 1}. ${removeSectionNumber(section.subtitle)}`,
  }));

  return { ...content, lastUpdated: LEGAL_LAST_UPDATED, sections };
}
