import type { Locale } from "../i18n";
import type { TourDefinition, TourId, TourStepDefinition } from "./types";

const copy = {
  es: {
    feed: ["¡Bienvenido a QNext!", "Te mostraremos rápidamente las principales funciones del Feed para que puedas empezar a explorar la plataforma.", "¡Ya conoces el Feed!", "Ahora tienes las herramientas principales para comenzar a explorar QNext."],
    profile_feed: ["Este es tu Profile Feed", "Aquí puedes administrar tu perfil y consultar tu actividad, conexiones, calificaciones, listas y recomendaciones.", "¡Tu Profile Feed está listo!", "Ya conoces las principales herramientas para administrar tu actividad y conexiones en QNext."],
    detail_movie: ["Conoce el detalle de una producción", "Aquí puedes explorar información sobre una película o serie e interactuar con ella y con otros usuarios de QNext.", "¡Ya conoces Detail Movie!", "Ahora puedes explorar, calificar y comentar producciones, compartir Video reacciones e interactuar con otros usuarios."],
  },
  en: {
    feed: ["Welcome to QNext!", "We'll quickly show you the main features of the Feed so you can start exploring the platform.", "You know the Feed!", "You now have the main tools you need to start exploring QNext."],
    profile_feed: ["This is your Profile Feed", "Here you can manage your profile and view your activity, connections, ratings, lists and recommendations.", "Your Profile Feed is ready!", "You now know the main tools for managing your activity and connections on QNext."],
    detail_movie: ["Explore a production", "Here you can explore information about a movie or series and interact with it and other QNext users.", "You know Detail Movie!", "You can now explore, rate and comment on productions, share Video Reactions and interact with other users."],
  },
} as const;

const stepCopy = {
  es: {
    feed: [["Busca lo que quieres ver","Encuentra películas y series utilizando el buscador."],["Explora por género","Selecciona hasta tres géneros para personalizar las producciones que aparecen en el Feed."],["Tu perfil personal","Desde aquí puedes acceder a tu Perfil personal, donde encontrarás tu actividad, calificaciones, listas, recomendaciones y otras opciones de tu perfil."],["Tus notificaciones","Aquí recibirás avisos sobre interacciones y actividad relacionada contigo."],["Menú de QNext","Desde aquí puedes acceder a las diferentes opciones de la plataforma."],["Conoce las producciones","Cada tarjeta contiene información y acciones para descubrir, guardar, recomendar y calificar películas y series."],["Conoce más sobre una producción","Haz clic en el póster o en el nombre para abrir el detalle de la producción."],["Consulta la sinopsis","Utiliza esta opción para conocer rápidamente de qué trata la producción."],["Guarda y recomienda","Guárdala para después\nUsa la etiqueta para agregar una producción a Mi Lista y recordar que quieres verla.\n\nRecomiéndala\nUsa el ticket para agregar esta producción a Mis Recomendadas."],["Compara las calificaciones","Calificación general\nConsulta la valoración general de la producción. Puedes conocer más sobre nuestro sistema de calificación en Políticas y términos.\n\nCalificación de seguidos\nMuestra la calificación promedio otorgada a esta producción por los usuarios que sigues.\n\nTu calificación\nAquí puedes consultar y asignar tu propia calificación a la película o serie, la cual hará parte del promedio en Calificación general."]],
    profile_feed: [["Tu perfil","Aquí encontrarás la información principal de tu perfil. Haz clic en tu avatar para consultar o actualizar tus datos personales."],["Tus producciones favoritas","Aquí puedes seleccionar y dar a conocer tus tres producciones favoritas +"],["Tus conexiones","Consulta los usuarios que sigues y tus amigos. Desde aquí puedes explorar sus perfiles y mantenerte conectado con su actividad."],["Mi Actividad","Consulta en orden cronológico tus principales acciones e interacciones dentro de QNext."],["Buzón privado","Aquí puedes consultar los mensajes privados que has intercambiado con tus Amigos a través de Comentarios dirigidos."],["Mis Calificaciones","Consulta las películas y series que has calificado."],["Mi Lista","Aquí encontrarás las producciones que guardaste con la etiqueta 🏷️ para recordar que quieres verlas."],["Mis Recomendadas","Aquí encontrarás las películas y series que marcaste con el ticket 🎟️ porque quieres recomendarlas a otros usuarios."],["Actividad de tus seguidos","Consulta la actividad reciente de los usuarios que sigues y descubre qué están viendo, calificando, comentando o recomendando." ]],
    detail_movie: [["Información de la producción","Consulta aquí el título y la información principal de la película o serie."],["Compara las calificaciones","⭐ Calificación general. 👥 Calificación de seguidos. 🙂 Tu calificación."],["Mira el tráiler","Pasa el cursor sobre el póster para reproducir el tráiler.","Mantén presionado el póster para reproducir el tráiler."],["Video reacciones","Mira las reacciones en video que otros usuarios han compartido."],["Comparte tu Video reacción","Usa REC para grabar una reacción de hasta 20 segundos o cargar un video."],["Interactúa con otras reacciones","Reproduce las Video reacciones y expresa si te gustan mediante 👍 o 👎."],["Participa en la conversación","Comparte tu opinión pública o envía un comentario dirigido a un Amigo."],["Comentarios públicos","Consulta lo que tú y la comunidad piensan sobre esta producción."],["Comentarios dirigidos","Envía y consulta comentarios intercambiados con tus Amigos."],["Participa en los comentarios","Indica si te gusta o no un comentario mediante 👍 o 👎."],["Vuelve a tu perfil","Haz clic en tu avatar para regresar directamente a tu Profile Feed."]],
  },
  en: {
    feed: [["Find what you want to watch","Find movies and series using the search bar."],["Explore by genre","Select up to three genres to personalize the productions shown in your Feed."],["Your personal profile","From here you can access your Profile Feed, where you'll find your activity, ratings, lists, recommendations and other profile options."],["Your notifications","Here you'll receive alerts about interactions and activity related to you."],["QNext menu","Access the different options available across the platform."],["Discover productions","Each card contains information and actions to discover, save, recommend and rate productions."],["Learn more about a production","Click the poster or title to open its detail page."],["Read the synopsis","Use this option to quickly learn what the production is about."],["Save and recommend","Save it for later\nUse the tag to add a production to My List so you remember you want to watch it.\n\nRecommend it\nUse the ticket to add this production to My Recommendations."],["Compare ratings","Overall rating\nView the production's overall rating. Learn more about our rating system in Policies and Terms.\n\nFollowing rating\nShows the average rating given by the users you follow.\n\nYour rating\nHere you can view and assign your own rating to the movie or series, which will contribute to the Overall Rating average."]],
    profile_feed: [["Your profile","Find your main profile information here. Click your avatar to view or update it."],["Your favorite productions","Select and showcase your three favorite productions."],["Your connections","View the users you follow and your Friends. From here you can explore their profiles and stay connected with their activity."],["My Activity","View your main QNext actions and interactions chronologically."],["Private Inbox","Here you can view the private messages you've exchanged with your Friends through Directed Comments."],["My Ratings","View the movies and series you've rated."],["My List","Find productions saved with the 🏷️ tag to remember to watch them."],["My Recommendations","Here you'll find the movies and series you marked with the 🎟️ ticket because you want to recommend them to other users."],["Following activity","View the recent activity of the users you follow and discover what they're watching, rating, commenting on or recommending."]],
    detail_movie: [["Production information","View the title and main information about this production."],["Compare ratings","⭐ Overall rating. 👥 Following rating. 🙂 Your rating."],["Watch the trailer","Hover over the poster to play the trailer.","Press and hold the poster to play the trailer."],["Video reactions","Watch video reactions shared by other users."],["Share your Video Reaction","Use REC to record up to 20 seconds or upload a video."],["Interact with other reactions","Play Video Reactions and react using 👍 or 👎."],["Join the conversation","Share a public opinion or send a directed comment to a Friend."],["Public Comments","See what you and the community think about this production."],["Directed Comments","Send and view comments exchanged with Friends."],["Interact with comments","Show whether you like or dislike a comment using 👍 or 👎."],["Return to your profile","Click your avatar to return directly to your Profile Feed."]],
  },
} as const;

const selectors: Record<TourId, Array<[string, boolean?]>> = {
  feed: [["feed-search"],["feed-genres"],["feed-profile"],["feed-notifications"],["feed-menu"],["feed-card"],["feed-card-poster"],["feed-card-synopsis",true],["feed-card-actions",true],["feed-card-ratings",true]],
  profile_feed: [["profile-info"],["profile-favorites"],["profile-connections"],["profile-activity"],["profile-inbox",true],["profile-ratings"],["profile-list"],["profile-recommendations"],["profile-following-activity"]],
  detail_movie: [["detail-info"],["detail-ratings"],["detail-trailer"],["detail-video-reactions",true],["detail-rec"],["detail-video-actions",true],["detail-comment-composer"],["detail-public-comments",true],["detail-directed-comments"],["detail-comment-reactions",true],["detail-profile"]],
};

const detailDesktopSelectors = ["detail-info", "detail-trailer", "detail-video-reactions", "detail-rec", "detail-comment-composer", "detail-public-comments", "detail-directed-comments", "detail-profile"] as const;
const detailDesktopCopy = {
  es: [
    ["Información de la producción", "Consulta aquí la información principal de la película o serie, incluida la información de disponibilidad en plataformas según tu país, director y reparto."],
    ["Mira el tráiler", "Pasa el cursor sobre el póster para reproducir el tráiler de la producción."],
    ["Video reacciones", "Mira las reacciones en video que otros usuarios han compartido sobre esta producción."],
    ["Comparte tu Video reacción", "Usa REC para grabar una reacción de hasta 20 segundos o cargar un video desde tu dispositivo."],
    ["Participa en la conversación", "Desde aquí puedes compartir tu opinión pública sobre la producción o enviar un comentario dirigido a un Amigo sobre la misma."],
    ["Comentarios públicos", "Consulta lo que tú y la comunidad piensan sobre esta producción."],
    ["Comentarios dirigidos", "Envía y consulta los comentarios intercambiados con tus Amigos acerca de sus opiniones sobre la producción. Estos mensajes son privados."],
    ["Vuelve a tu perfil", "Haz clic en tu avatar cuando quieras regresar directamente a tu Perfil personal."],
  ],
  en: [
    ["Production information", "Here you can view the main information about the movie or series, including platform availability in your country, director and cast."],
    ["Watch the trailer", "Hover over the poster to play the production's trailer."],
    ["Video reactions", "Watch the video reactions other users have shared about this production."],
    ["Share your Video Reaction", "Use REC to record a reaction of up to 20 seconds or upload a video from your device."],
    ["Join the conversation", "From here you can share your public opinion about the production or send a directed comment about it to a Friend."],
    ["Public Comments", "See what you and the community think about this production."],
    ["Directed Comments", "Send and view comments exchanged with your Friends about their opinions on the production. These messages are private."],
    ["Return to your profile", "Click your avatar whenever you want to return directly to your Profile Feed."],
  ],
} as const;

export function getTourDefinitions(locale: Locale): TourDefinition[] {
  return (["feed", "profile_feed", "detail_movie"] as TourId[]).map((id) => {
    const [welcomeTitle, welcomeBody, finalTitle, finalBody] = copy[locale][id];
    const steps: TourStepDefinition[] = selectors[id].map(([target, optional], index) => {
      const item = stepCopy[locale][id][index];
      return { target: `[data-tour="${target}"]`, title: item[0], body: item[1], mobileBody: item[2], optional };
    });
    let mobileSteps: TourStepDefinition[] | undefined;
    if (id === "feed") {
      const icons: NonNullable<TourStepDefinition["icon"]>[] = ["search", "filter", "profile", "notifications", "menu", "productions"];
      icons.forEach((icon, index) => { steps[index].icon = icon; });
      const cardTarget = `[data-tour="feed-card"]`;
      for (let index = 5; index < steps.length; index += 1) {
        steps[index].target = cardTarget;
        steps[index].spotlightTarget = cardTarget;
        steps[index].optional = false;
      }
      steps[6].callouts = [{ target: `[data-tour="feed-card-poster"]` }, { target: `[data-tour="feed-card-title"]`, anchor: "start" }];
      steps[7].callouts = [{ target: `[data-tour="feed-card-synopsis"]` }];
      steps[8].callouts = [{ target: `[data-tour="feed-card-tag"]`, label: locale === "en" ? "My List" : "Mi Lista", placement: "top" }, { target: `[data-tour="feed-card-ticket"]`, label: locale === "en" ? "Recommend" : "Recomendar", placement: "bottom" }];
      steps[9].callouts = [{ target: `[data-tour="feed-card-rating-overall"]`, label: locale === "en" ? "Overall" : "General", placement: "top" }, { target: `[data-tour="feed-card-rating-following"]`, label: locale === "en" ? "Following" : "Seguidos", placement: "bottom" }, { target: `[data-tour="feed-card-rating-mine"]`, label: locale === "en" ? "Your rating" : "Tu calificación", placement: "top" }];
      const mobileTargets = ["feed-search-mobile", "feed-genres", "feed-profile-mobile", "feed-notifications-mobile", "feed-menu-mobile", "feed-card", "feed-card", "feed-card", "feed-card", "feed-card"] as const;
      const mobilePreparations: TourStepDefinition["mobilePrepare"][] = ["feed-mobile-panel-show", "feed-mobile-panel-release", "feed-mobile-panel-show", "feed-mobile-panel-show", "feed-mobile-panel-release", "feed-mobile-panel-release", "feed-mobile-panel-release", "feed-mobile-panel-release", "feed-mobile-panel-release", "feed-mobile-panel-release"];
      mobileSteps = steps.map((step, index) => ({
        ...step,
        target: index === 1 || index >= 5 ? `[data-tour="${mobileTargets[index]}"]` : `[data-tour-mobile="${mobileTargets[index]}"]`,
        spotlightTarget: index >= 5 ? `[data-tour="feed-card"]` : undefined,
        callouts: step.callouts?.map((callout) => ({ ...callout })),
        mobilePrepare: mobilePreparations[index],
        optional: false,
      }));
      mobileSteps[6].callouts = [{ target: `[data-tour="feed-card-poster"]` }, { target: `[data-tour="feed-card-title"]`, anchor: "start" }];
      mobileSteps[8].callouts = [{ target: `[data-tour="feed-card-tag"]`, label: locale === "en" ? "My List" : "Mi Lista", placement: "top" }, { target: `[data-tour="feed-card-ticket"]`, label: locale === "en" ? "Recommend" : "Recomendar", placement: "bottom" }];
      mobileSteps[9].callouts = [{ target: `[data-tour="feed-card-rating-overall"]`, label: locale === "en" ? "Overall" : "General", placement: "top" }, { target: `[data-tour="feed-card-rating-following"]`, label: locale === "en" ? "Following" : "Seguidos", placement: "bottom" }, { target: `[data-tour="feed-card-rating-mine"]`, label: locale === "en" ? "Your rating" : "Tu calificación", placement: "top" }];
    }
    if (id === "profile_feed") {
      const icons: NonNullable<TourStepDefinition["icon"]>[] = ["profile", "favorite", "connections", "activity", "inbox", "ratings", "list", "recommendations", "menu"];
      const preparations: Array<TourStepDefinition["prepare"]> = [undefined, undefined, undefined, "profile-activity", "profile-inbox", "profile-ratings", "profile-list", "profile-recommendations", undefined];
      steps.forEach((step, index) => { step.icon = icons[index]; step.prepare = preparations[index]; step.optional = false; });
    }
    const desktopSteps = id === "detail_movie" ? detailDesktopSelectors.map((target, index): TourStepDefinition => ({
      target: `[data-tour-desktop="${target}"]`,
      title: detailDesktopCopy[locale][index][0],
      body: detailDesktopCopy[locale][index][1],
      icon: (["information", "play", "video", "rec", "conversation", "comments", "directed", "profile"] as const)[index],
      prepare: ([undefined, "detail-video", "detail-video", "detail-video", "detail-comments-public", "detail-comments-public", "detail-comments-directed", undefined] as const)[index],
      optional: false,
    })) : undefined;
    return { id, path: id === "feed" ? (p) => p === "/feed" : id === "profile_feed" ? (p) => p === "/profile-feed" : (p) => /^\/movies\/[^/]+\/?$/.test(p), readyTargets: [`[data-tour="${selectors[id][0][0]}"]`], welcomeTitle, welcomeBody, finalTitle, finalBody, steps, desktopSteps, mobileSteps };
  });
}

export const commonTourCopy = (locale: Locale) => locale === "en" ? { skip:"Skip", start:"Start", continue:"Continue", back:"Back", next:"Next", finish:"Finish", close:"Close", resumeTitle:"Would you like to continue the tour?", resumeBody:"You left this tour unfinished." } : { skip:"Omitir", start:"Comenzar", continue:"Continuar", back:"Volver", next:"Siguiente", finish:"Finalizar", close:"Cerrar", resumeTitle:"¿Quieres continuar el recorrido?", resumeBody:"Dejaste esta presentación a medias." };
